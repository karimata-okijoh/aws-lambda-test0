import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
  PutCommandInput,
  GetCommandInput,
  UpdateCommandInput,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { logger } from './logger';

// DynamoDBクライアントの初期化
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

// リトライ設定
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

/**
 * 指数バックオフでリトライを実行するヘルパー関数
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        logger.info(`${operationName} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      logger.warn(`${operationName} failed on attempt ${attempt}/${retries}`, {
        error: lastError.message,
        attempt,
      });

      if (attempt < retries) {
        // 指数バックオフ: 100ms, 200ms, 400ms
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // すべてのリトライが失敗した場合
  logger.error(`${operationName} failed after ${retries} attempts`, {
    error: lastError?.message,
    stack: lastError?.stack,
  });

  throw new Error(
    `${operationName} failed after ${retries} attempts: ${lastError?.message}`
  );
}

/**
 * DynamoDBにアイテムを保存（Put操作）
 */
export async function putItem(
  tableName: string,
  item: Record<string, any>,
  autoTimestamp = true
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // タイムスタンプの自動記録
  const itemWithTimestamp = autoTimestamp
    ? {
        ...item,
        createdAt: item.createdAt || timestamp,
        updatedAt: timestamp,
      }
    : item;

  const params: PutCommandInput = {
    TableName: tableName,
    Item: itemWithTimestamp,
  };

  await retryWithBackoff(
    async () => {
      const command = new PutCommand(params);
      await docClient.send(command);
      
      logger.info('Item saved successfully', {
        tableName,
        itemKey: item.email || item.sessionId || 'unknown',
      });
    },
    `putItem to ${tableName}`,
    MAX_RETRIES
  );
}

/**
 * DynamoDBからアイテムを取得（Get操作）
 */
export async function getItem<T = Record<string, any>>(
  tableName: string,
  key: Record<string, any>
): Promise<T | null> {
  const params: GetCommandInput = {
    TableName: tableName,
    Key: key,
  };

  return await retryWithBackoff(
    async () => {
      const command = new GetCommand(params);
      const result = await docClient.send(command);
      
      if (result.Item) {
        logger.info('Item retrieved successfully', {
          tableName,
          key,
        });
        return result.Item as T;
      }
      
      logger.info('Item not found', {
        tableName,
        key,
      });
      return null;
    },
    `getItem from ${tableName}`,
    MAX_RETRIES
  );
}

/**
 * DynamoDBのアイテムを更新（Update操作）
 */
export async function updateItem(
  tableName: string,
  key: Record<string, any>,
  updates: Record<string, any>,
  autoTimestamp = true
): Promise<void> {
  // タイムスタンプの自動記録
  const updatesWithTimestamp = autoTimestamp
    ? {
        ...updates,
        updatedAt: new Date().toISOString(),
      }
    : updates;

  // UpdateExpressionとExpressionAttributeValuesを構築
  const updateExpressions: string[] = [];
  const expressionAttributeValues: Record<string, any> = {};
  const expressionAttributeNames: Record<string, string> = {};

  Object.keys(updatesWithTimestamp).forEach((key, index) => {
    const placeholder = `:val${index}`;
    const namePlaceholder = `#attr${index}`;
    
    updateExpressions.push(`${namePlaceholder} = ${placeholder}`);
    expressionAttributeValues[placeholder] = updatesWithTimestamp[key];
    expressionAttributeNames[namePlaceholder] = key;
  });

  const params: UpdateCommandInput = {
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
  };

  await retryWithBackoff(
    async () => {
      const command = new UpdateCommand(params);
      await docClient.send(command);
      
      logger.info('Item updated successfully', {
        tableName,
        key,
        updatedFields: Object.keys(updatesWithTimestamp),
      });
    },
    `updateItem in ${tableName}`,
    MAX_RETRIES
  );
}

/**
 * DynamoDBテーブルをスキャン（Scan操作）
 */
export async function scanTable<T = Record<string, any>>(
  tableName: string,
  filterExpression?: string,
  expressionAttributeValues?: Record<string, any>
): Promise<T[]> {
  const params: ScanCommandInput = {
    TableName: tableName,
    FilterExpression: filterExpression,
    ExpressionAttributeValues: expressionAttributeValues,
  };

  return await retryWithBackoff(
    async () => {
      const command = new ScanCommand(params);
      const result = await docClient.send(command);
      
      const items = (result.Items || []) as T[];
      
      logger.info('Table scanned successfully', {
        tableName,
        itemCount: items.length,
      });
      
      return items;
    },
    `scanTable ${tableName}`,
    MAX_RETRIES
  );
}

/**
 * セッションをSessionsテーブルに保存
 */
export async function saveSession(
  sessionId: string,
  email: string,
  role: 'user' | 'admin',
  expiresInSeconds = 86400 // デフォルト24時間
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresInSeconds;

  await putItem(
    process.env.SESSIONS_TABLE || 'teamviewer-survey-sessions',
    {
      sessionId,
      email,
      role,
      createdAt: now,
      expiresAt,
    },
    false // タイムスタンプは手動で設定（Unix時間を使用）
  );
}

/**
 * セッションをSessionsテーブルから取得
 */
export async function getSession(sessionId: string): Promise<{
  sessionId: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: number;
  expiresAt: number;
} | null> {
  return await getItem(
    process.env.SESSIONS_TABLE || 'teamviewer-survey-sessions',
    { sessionId }
  );
}

/**
 * アンケート回答をResponsesテーブルに保存
 */
export async function saveResponse(
  email: string,
  responses: Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  }>
): Promise<void> {
  // 既存の回答を取得
  const existingResponse = await getResponse(email);

  if (existingResponse) {
    // 既存の回答がある場合は更新
    const mergedResponses = {
      ...existingResponse.responses,
      ...responses,
    };

    await updateItem(
      process.env.RESPONSES_TABLE || 'teamviewer-survey-responses',
      { email },
      { responses: mergedResponses }
    );
  } else {
    // 新規回答の場合は作成
    await putItem(
      process.env.RESPONSES_TABLE || 'teamviewer-survey-responses',
      {
        email,
        responses,
      }
    );
  }
}

/**
 * アンケート回答をResponsesテーブルから取得
 */
export async function getResponse(email: string): Promise<{
  email: string;
  responses: Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
} | null> {
  return await getItem(
    process.env.RESPONSES_TABLE || 'teamviewer-survey-responses',
    { email }
  );
}

/**
 * すべてのアンケート回答を取得（レポート生成用）
 */
export async function getAllResponses(): Promise<Array<{
  email: string;
  responses: Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}>> {
  return await scanTable(
    process.env.RESPONSES_TABLE || 'teamviewer-survey-responses'
  );
}

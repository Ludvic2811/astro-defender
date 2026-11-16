// AWS Lambda (Node.js 22) – API de la tabla de líderes sobre DynamoDB.
//   GET  /scores?mode=solo|coop&limit=10  -> mejores puntuaciones
//   POST /scores {name, score, wave, mode, players}
// La tabla tiene un índice global "ByMode" (mode = partición, score = orden).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from './core.mjs';

const TABLE = process.env.TABLE_NAME;
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const db = {
  put: (item) => doc.send(new PutCommand({ TableName: TABLE, Item: item })),
  top: async (mode, limit) => {
    const res = await doc.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'ByMode',
      KeyConditionExpression: '#m = :m',
      ExpressionAttributeNames: { '#m': 'mode' },
      ExpressionAttributeValues: { ':m': mode },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (res.Items || []).map(({ name, score, wave, players, createdAt }) => ({ name, score, wave, players, createdAt }));
  },
};

export const handler = createHandler(db);

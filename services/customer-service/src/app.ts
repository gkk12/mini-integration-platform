import express from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const app = express();
app.use(express.json());

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'Customers';

// Liveness check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'customer-service' });
});

// Validate Customer Endpoint
app.get('/customers/:id/validate', async (req, res) => {
  const customerId = req.params.id;
  
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: customerId }
    }));

    if (!result.Item) {
      return res.status(404).json({ valid: false, reason: 'Customer not found' });
    }

    if (result.Item.status !== 'ACTIVE') {
      return res.status(400).json({ valid: false, reason: 'Customer is inactive' });
    }

    return res.json({ valid: true, customer: result.Item });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default app;
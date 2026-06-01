import express from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const app = express();
app.use(express.json());

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'Customers';
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Local mock database for offline development
const mockCustomers: Record<string, { id: string; name: string; status: string }> = {
  "1": { id: "1", name: "Gautham Kamath", status: "ACTIVE" },
  "2": { id: "2", name: "Jane Doe", status: "INACTIVE" }
};

app.get('/health', (_, res) => {
  res.json({ status: 'UP', service: 'customer-service', mockMode: MOCK_MODE });
});

app.get('/customers/:id/validate', async (req, res) => {
  const customerId = req.params.id;
  
  // 1. Testing locally
  if (MOCK_MODE) {
    const customer = mockCustomers[customerId];
    if (!customer) {
      return res.status(404).json({ valid: false, reason: 'Customer not found (Mock)' });
    }
    if (customer.status !== 'ACTIVE') {
      return res.status(400).json({ valid: false, reason: 'Customer is inactive (Mock)' });
    }
    return res.json({ valid: true, customer });
  }

  // 2. Production AWS DynamoDB Path
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
    console.error("DynamoDB Error:", error);
    return res.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
});

export default app;
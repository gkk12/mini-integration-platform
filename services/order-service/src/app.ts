import express from 'express';

const app = express();
app.use(express.json());

interface CustomerValidationResponse {
  valid: boolean;
  customer?: {
    id: string;
    name: string;
    status: string;
  };
  reason?: string;
}

const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3001';

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'order-service' });
});

app.post('/orders', async (req, res) => {
  const { customerId, items, total } = req.body;

  if (!customerId || !items) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Service-to-Service Integration Call
    const response = await fetch(`${CUSTOMER_SERVICE_URL}/customers/${customerId}/validate`);
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return res.status(response.status).json({ 
        error: 'Customer validation failed', 
        details: errData 
      });
    }

    const validation = await response.json() as CustomerValidationResponse;
    
    // Simulate order placement
    return res.status(201).json({
      message: 'Order placed successfully',
      order: {
        orderId: Math.random().toString(36).substring(7),
        customerId,
        total,
        status: 'CONFIRMED'
      },
      validatedUser: validation.customer?.name || 'Unknown Customer'
    });

  } catch (error) {
    console.error('Integration Error:', error);
    return res.status(502).json({ error: 'Bad Gateway. Unable to contact Customer Service.' });
  }
});

export default app;
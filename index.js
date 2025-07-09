const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory store (not for production)
const paymentStatusMap = {}; // { tran_id: status }

app.post('/initiate-payment', async (req, res) => {
  const { amount, email } = req.body;

  if (!amount || !email) {
    return res.status(400).json({ error: 'Missing amount or email' });
  }

  const tran_id = `TXN_${Date.now()}`;
  const payload = {
    store_id: 'patua685d01b8d4ca6',
    store_passwd: 'patua685d01b8d4ca6@ssl',
    total_amount: amount,
    currency: 'BDT',
    tran_id,
    // IMPORTANT: These URLs point to your server to update status and redirect properly
    success_url: `https://aurmita.com/success?tran_id=${tran_id}`,
    fail_url: `https://aurmita.com/fail?tran_id=${tran_id}`,
    cancel_url: `https://aurmita.com/cancel?tran_id=${tran_id}`,
    ipn_url: 'https://sslc.onrender.com/ipn', // IPN endpoint for async updates (optional)
    cus_name: 'Customer',
    cus_email: email,
    cus_phone: '01700000000',
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_postcode: '1212',
    cus_country: 'Bangladesh',
    shipping_method: 'NO',
    num_of_item: 1,
    product_name: 'Subscription',
    product_category: 'Services',
    product_profile: 'general',
  };

  try {
    const params = new URLSearchParams(payload).toString();

    const response = await axios.post(
      'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
      params,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    if (response.data?.status === 'SUCCESS') {
      // Store status as pending (in memory for demo)
      paymentStatusMap[tran_id] = 'PENDING';

      return res.json({
        GatewayPageURL: response.data.GatewayPageURL,
        transactionId: tran_id,
      });
    } else {
      return res.status(400).json({
        error: 'Failed to generate payment URL',
        debug: response.data,
      });
    }
  } catch (error) {
    console.error('Payment initiation error:', error.message);
    return res.status(500).json({ error: 'Server error while initiating payment' });
  }
});

// IPN endpoint (async status updates from SSLCommerz)
app.post('/ipn', (req, res) => {
  const { tran_id, status } = req.body;

  if (!tran_id || !status) {
    return res.status(400).send('Missing transaction ID or status');
  }

  paymentStatusMap[tran_id] = status;
  console.log(`IPN received: ${tran_id} → ${status}`);

  res.status(200).send('OK');
});

// Success handler: update status and redirect frontend
app.get('/success', (req, res) => {
  const tran_id = req.query.tran_id;
  if (tran_id) {
    paymentStatusMap[tran_id] = 'SUCCESS';
    console.log(`✅ Payment SUCCESS for ${tran_id}`);
  }
  res.redirect(`http://localhost:3000/payment-result?tran_id=${tran_id}`);
});

// Fail handler: update status and redirect frontend
app.get('/fail', (req, res) => {
  const tran_id = req.query.tran_id;
  if (tran_id) {
    paymentStatusMap[tran_id] = 'FAILED';
    console.log(`❌ Payment FAILED for ${tran_id}`);
  }
  res.redirect(`http://localhost:3000/payment-result?tran_id=${tran_id}`);
});

// Cancel handler: update status and redirect frontend
app.get('/cancel', (req, res) => {
  const tran_id = req.query.tran_id;
  if (tran_id) {
    paymentStatusMap[tran_id] = 'CANCELLED';
    console.log(`⚠️ Payment CANCELLED for ${tran_id}`);
  }
  res.redirect(`http://localhost:3000/payment-result?tran_id=${tran_id}`);
});

// Endpoint to check payment status
app.get('/payment-status/:tran_id', (req, res) => {
  const tran_id = req.params.tran_id;
  const status = paymentStatusMap[tran_id] || 'UNKNOWN';
  res.json({ status });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

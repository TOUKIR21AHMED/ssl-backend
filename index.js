const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 🗂️ In-memory store (replace with DB for production)
const paymentStatusMap = {}; // { tran_id: status }

// 🚀 Initiate payment
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
    tran_id: tran_id,
    success_url: `http://localhost:3000/payment-result?tran_id=${tran_id}`,
    fail_url: `http://localhost:3000/payment-result?tran_id=${tran_id}`,
    cancel_url: `http://localhost:3000/payment-result?tran_id=${tran_id}`,
    ipn_url: 'https://sslc.onrender.com/ipn',
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
      // Save status as PENDING for now
      paymentStatusMap[tran_id] = 'PENDING';
      console.log(`🟢 Initiated payment for ${tran_id} → PENDING`);

      return res.json({
        GatewayPageURL: response.data.GatewayPageURL,
        transactionId: tran_id,
      });
    } else {
      console.error('❌ SSLCommerz response error:', response.data);
      return res.status(400).json({
        error: 'Failed to generate payment URL',
        debug: response.data,
      });
    }
  } catch (error) {
    console.error('❌ Payment initiation error:', error.message);
    return res.status(500).json({ error: 'Server error while initiating payment' });
  }
});

// 📨 IPN endpoint (called by SSLCommerz)
app.post('/ipn', async (req, res) => {
  const { tran_id, status } = req.body;

  if (!tran_id || !status) {
    return res.status(400).send('Missing transaction ID or status');
  }

  paymentStatusMap[tran_id] = status;
  console.log(`📩 IPN received: ${tran_id} → ${status}`);

  res.status(200).send('OK');
});

// ✅ Payment result polling endpoint
app.get('/payment-status/:tran_id', (req, res) => {
  const tran_id = req.params.tran_id;
  const status = paymentStatusMap[tran_id] || 'UNKNOWN';
  console.log(`🔍 Payment status check: ${tran_id} → ${status}`);
  res.json({ status });
});

// ✅ Manual fallback: mark status success if redirected back
app.get('/success', (req, res) => {
  const tran_id = req.query.tran_id;
  if (tran_id) {
    paymentStatusMap[tran_id] = 'SUCCESS';
    console.log(`✅ Manual success via /success for ${tran_id}`);
  }
  res.send('<h2>✅ Payment Successful</h2><p>You may close this window.</p>');
});

app.get('/fail', (req, res) => {
  const tran_id = req.query.tran_id;
  if (tran_id) {
    paymentStatusMap[tran_id] = 'FAILED';
    console.log(`❌ Manual fail via /fail for ${tran_id}`);
  }
  res.send('<h2>❌ Payment Failed</h2><p>Please try again.</p>');
});

app.get('/cancel', (req, res) => {
  const tran_id = req.query.tran_id;
  if (tran_id) {
    paymentStatusMap[tran_id] = 'CANCELLED';
    console.log(`⚠️ Manual cancel via /cancel for ${tran_id}`);
  }
  res.send('<h2>⚠️ Payment Cancelled</h2><p>Payment was cancelled.</p>');
});

// ✅ Server listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

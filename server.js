const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// 🔐 PUT YOUR REAL AUTH ID HERE
const AUTH_ID = "01KDERAAGTFHCFMNMZ6S0R3EVH";

const DATA_FILE = path.join(__dirname, "transactions.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ======================
   SAFE JSON HANDLING
====================== */
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { balance: 0, current: null };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { balance: 0, current: null };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ======================
   REQUEST PAYMENT
====================== */
app.post("/pay", async (req, res) => {
  const { phone, amount } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ error: "phone and amount required" });
  }

  try {
    const apiRes = await axios.post(
      "https://api.moneyunify.one/payments/request",
      {
        from_payer: phone,
        amount,
        auth_id: AUTH_ID
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const apiData = apiRes.data;

    // MoneyUnify returns transaction_id INSIDE data
    const txId = apiData?.data?.transaction_id;

    if (!txId) {
      return res.status(400).json({
        error: "transaction_id missing",
        api_response: apiData
      });
    }

    // Save ONLY this transaction
    saveData({
      balance: readData().balance,
      current: {
        transaction_id: txId,
        phone,
        amount: Number(amount),
        status: "pending",
        verify_response: null,
        completed: false,
        created_at: new Date().toISOString(),
        last_checked: null
      }
    });

    res.json(apiData);

  } catch (err) {
    res.status(500).json({
      error: "Payment request failed",
      details: err.response?.data || err.message
    });
  }
});

/* ======================
   VERIFY CURRENT TX ONLY
====================== */
async function verifyCurrentTransaction() {
  const store = readData();
  const tx = store.current;

  if (!tx) return;
  if (tx.completed) return;

  try {
    const verifyRes = await axios.post(
      "https://api.moneyunify.one/payments/verify",
      new URLSearchParams({
        transaction_id: tx.transaction_id,
        auth_id: AUTH_ID
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        }
      }
    );

    const result = verifyRes.data;

    // Store RAW verify response for GUI
    tx.verify_response = result;
    tx.last_checked = new Date().toISOString();

    // Extract status safely
    const status =
      result?.data?.status ||
      result?.status ||
      "pending";

    tx.status = status;

    // ✅ FINAL STATES
    if (status === "successful") {
      store.balance += tx.amount;
      tx.completed = true;
    }

    if (status === "failed") {
      tx.completed = true;
    }

    saveData(store);

    console.log(`[VERIFY] ${tx.transaction_id} → ${status}`);

  } catch (err) {
    console.error("[VERIFY ERROR]", err.message);
  }
}

// 🔁 Poll every 3 seconds
setInterval(verifyCurrentTransaction, 3000);

/* ======================
   GUI STATUS ENDPOINT
====================== */
app.get("/status", (req, res) => {
  const store = readData();

  if (!store.current) {
    return res.json({ balance: store.balance });
  }

  res.json({
    status: store.current.status,
    verify_response: store.current.verify_response,
    balance: store.balance // ✅ include balance here
  });
});

/* ======================
   START SERVER
====================== */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

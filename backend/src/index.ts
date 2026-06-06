import express from 'express';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { db } from './db';
import { Message, Channel, Role } from './models/types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS so the Angular frontend can access this server
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize WebSocket Server
const wss = new WebSocketServer({ noServer: true });

// Active WebSocket connections
interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
}
const clients = new Set<ConnectedClient>();

// Handle Upgrade header for WebSockets
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Broadcast helper
function broadcast(data: any) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  const client: ConnectedClient = { ws };
  clients.add(client);
  console.log(`WebSocket client connected. Total clients: ${clients.size}`);

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);
      console.log('Received WS message:', data);

      if (data.type === 'auth') {
        client.userId = data.userId;
      } else if (data.type === 'send_message') {
        const { channelId, authorId, text } = data.payload;
        if (!channelId || !authorId || !text) return;

        const msgCounter = (await db.get('messages')).length + 1000;
        const newMsg: Message = {
          id: `msg-${msgCounter}`,
          channelId,
          authorId,
          text: text.trim(),
          timestamp: new Date().toISOString(),
        };

        // Insert message
        await db.insert('messages', newMsg);

        // Update channel lastMessage
        await db.updateById('channels', channelId, (chan: Channel) => {
          return { lastMessage: newMsg, unread: 0 };
        });

        // Broadcast to everyone
        broadcast({
          type: 'new_message',
          payload: newMsg
        });
      } else if (data.type === 'typing') {
        // Broadcast typing state to other clients
        broadcast({
          type: 'typing',
          payload: {
            channelId: data.channelId,
            userId: data.userId,
            username: data.username,
            typing: data.typing
          }
        });
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(client);
    console.log(`WebSocket client disconnected. Total clients: ${clients.size}`);
  });
});

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// --- Users ---
app.get('/api/users', async (req, res) => {
  try {
    const data = await db.get('users');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Patients ---
app.get('/api/patients', async (req, res) => {
  try {
    const data = await db.get('patients');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/patients/:id', async (req, res) => {
  try {
    const patients = await db.get('patients');
    const patient = patients.find(p => p.id === req.params.id);
    if (patient) {
      res.json(patient);
    } else {
      res.status(404).json({ error: 'Patient not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const body = req.body;
    const count = (await db.get('patients')).length + 1;
    const newPatient = {
      ...body,
      id: body.id || `pat-${count}`,
      mrn: body.mrn || `MRN-${String(count).padStart(5, '0')}`,
      admitDate: body.admitDate || new Date().toISOString()
    };
    await db.insert('patients', newPatient);
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Vitals ---
app.get('/api/vitals', async (req, res) => {
  try {
    const data = await db.get('vitals');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/vitals/patient/:patientId', async (req, res) => {
  try {
    const vitals = await db.get('vitals');
    const patientVitals = vitals.filter(v => v.patientId === req.params.patientId);
    res.json(patientVitals);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/vitals', async (req, res) => {
  try {
    const { patientId, hr, systolic, diastolic, glucose, spo2, temp, note, recordedBy } = req.body;
    if (!patientId || hr === undefined || systolic === undefined || spo2 === undefined) {
      return res.status(400).json({ error: 'Missing required vitals fields' });
    }

    // Calculate flags
    const critical = hr > 110 || hr < 50 || systolic > 160 || systolic < 90 || spo2 < 92 || temp > 100.4;
    const watch = !critical && (hr > 95 || systolic > 145 || spo2 < 95 || glucose > 180);
    const flag = critical ? 'critical' : watch ? 'watch' : 'normal';

    const newReading = {
      id: `vtl-${Date.now()}`,
      patientId,
      timestamp: new Date().toISOString(),
      hr,
      systolic,
      diastolic,
      glucose,
      spo2,
      temp: temp || 98.6,
      flag,
      note,
      recordedBy
    };

    await db.insert('vitals', newReading);

    // Broadcast socket event for real-time dashboard updates
    broadcast({
      type: 'new_vital',
      payload: newReading
    });

    res.status(201).json(newReading);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Medications ---
app.get('/api/medications', async (req, res) => {
  try {
    const data = await db.get('medications');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/medications/patient/:patientId', async (req, res) => {
  try {
    const medications = await db.get('medications');
    const meds = medications.filter(m => m.patientId === req.params.patientId);
    res.json(meds);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/medications', async (req, res) => {
  try {
    const body = req.body;
    const count = (await db.get('medications')).length + 1;
    const newMed = {
      ...body,
      id: `med-${count}`,
      times: body.times || [new Date().toISOString()]
    };
    await db.insert('medications', newMed);
    res.status(201).json(newMed);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Med Administrations ---
app.get('/api/med-administrations', async (req, res) => {
  try {
    const data = await db.get('medAdministrations');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/medications/:id/administer', async (req, res) => {
  try {
    const medId = req.params.id;
    const { givenBy, verifiedBy, patientId, skipped, reason } = req.body;

    const medications = await db.get('medications');
    const med = medications.find(m => m.id === medId);
    if (!med) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const count = (await db.get('medAdministrations')).length + 1;
    const newAdmin = {
      id: `adm-${count}`,
      medicationId: medId,
      patientId: patientId || med.patientId,
      givenAt: new Date().toISOString(),
      givenBy,
      verifiedBy,
      skipped,
      reason
    };

    await db.insert('medAdministrations', newAdmin);

    // Update lastGiven details on the medication if not skipped
    if (!skipped) {
      await db.updateById('medications', medId, () => ({
        lastGiven: newAdmin.givenAt,
        lastGivenBy: givenBy,
        refillsRemaining: Math.max(0, med.refillsRemaining - 1)
      }));
    }

    res.status(201).json(newAdmin);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Schedule ---
app.get('/api/schedule', async (req, res) => {
  try {
    const data = await db.get('schedule');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/schedule', async (req, res) => {
  try {
    const body = req.body;
    const count = (await db.get('schedule')).length + 1;
    const newEvent = {
      ...body,
      id: `sh-${count}`
    };
    await db.insert('schedule', newEvent);
    res.status(201).json(newEvent);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/schedule/:id', async (req, res) => {
  try {
    const updated = await db.updateById('schedule', req.params.id, () => req.body);
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Schedule event not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/geo-points', async (req, res) => {
  try {
    const data = await db.get('geoPoints');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Chat ---
app.get('/api/channels', async (req, res) => {
  try {
    const data = await db.get('channels');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const data = await db.get('messages');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/channels/:id/messages', async (req, res) => {
  try {
    const messages = await db.get('messages');
    const channelMsgs = messages
      .filter(m => m.channelId === req.params.id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    res.json(channelMsgs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/channels/:id/messages', async (req, res) => {
  try {
    const channelId = req.params.id;
    const { authorId, text } = req.body;
    if (!text || !authorId) {
      return res.status(400).json({ error: 'Missing message content or author' });
    }

    const msgCounter = (await db.get('messages')).length + 1000;
    const newMsg = {
      id: `msg-${msgCounter}`,
      channelId,
      authorId,
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    await db.insert('messages', newMsg);

    // Update channel lastMessage
    await db.updateById('channels', channelId, () => ({
      lastMessage: newMsg,
      unread: 0
    }));

    // Broadcast via websocket
    broadcast({
      type: 'new_message',
      payload: newMsg
    });

    res.status(201).json(newMsg);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/channels', async (req, res) => {
  try {
    const { name, kind, members } = req.body;
    if (!name || !kind) {
      return res.status(400).json({ error: 'Missing name or kind' });
    }

    const count = (await db.get('channels')).length + 1;
    const newChannel = {
      id: `ch-${count}`,
      name,
      kind,
      members: (members || []).map((userId: string) => ({
        userId,
        role: 'member' as const,
        lastRead: new Date().toISOString()
      })),
      unread: 0,
      pinned: false,
      encrypted: kind !== 'direct',
      topic: kind === 'care-team' ? 'Care team coordination' : undefined
    };

    await db.insert('channels', newChannel);
    res.status(201).json(newChannel);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/channels/:id/read', async (req, res) => {
  try {
    const updated = await db.updateById('channels', req.params.id, () => ({ unread: 0 }));
    if (updated) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Channel not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Billing ---
app.get('/api/invoices', async (req, res) => {
  try {
    const data = await db.get('invoices');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const body = req.body;
    const count = (await db.get('invoices')).length + 1;
    const newInvoice = {
      ...body,
      id: `inv-${count}`,
      number: body.number || `INV-2025-${String(count).padStart(4, '0')}`,
      issuedAt: body.issuedAt || new Date().toISOString()
    };
    await db.insert('invoices', newInvoice);
    res.status(201).json(newInvoice);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/claims', async (req, res) => {
  try {
    const data = await db.get('claims');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/claims/:id', async (req, res) => {
  try {
    const updated = await db.updateById('claims', req.params.id, () => req.body);
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Claim not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/timesheets', async (req, res) => {
  try {
    const data = await db.get('timesheets');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/timesheets', async (req, res) => {
  try {
    const body = req.body;
    const count = (await db.get('timesheets')).length + 1;
    const newTimesheet = {
      ...body,
      id: `ts-${count}`,
      clockIn: body.clockIn || new Date().toISOString()
    };
    await db.insert('timesheets', newTimesheet);
    res.status(201).json(newTimesheet);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/timesheets/:id', async (req, res) => {
  try {
    const updated = await db.updateById('timesheets', req.params.id, () => req.body);
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Timesheet not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Tasks ---
app.get('/api/tasks', async (req, res) => {
  try {
    const data = await db.get('tasks');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const body = req.body;
    const count = (await db.get('tasks')).length + 1;
    const newTask = {
      ...body,
      id: `tsk-${count}`,
      createdAt: new Date().toISOString(),
      estimateMin: body.estimateMin || 30
    };
    await db.insert('tasks', newTask);
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const updated = await db.updateById('tasks', req.params.id, () => req.body);
    if (updated) {
      // Broadcast for Kanban state changes
      broadcast({
        type: 'task_updated',
        payload: updated
      });
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const deleted = await db.deleteById('tasks', req.params.id);
    if (deleted) {
      broadcast({
        type: 'task_deleted',
        payload: { id: req.params.id }
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Wounds ---
app.get('/api/wounds', async (req, res) => {
  try {
    const data = await db.get('wounds');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/wounds/patient/:patientId', async (req, res) => {
  try {
    const wounds = await db.get('wounds');
    const patientWounds = wounds.filter(w => w.patientId === req.params.patientId);
    res.json(patientWounds);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/wounds', async (req, res) => {
  try {
    const body = req.body;
    const count = (await db.get('wounds')).length + 1;
    const newWound = {
      ...body,
      id: `wnd-${count}`,
      photos: body.photos || [],
      assessedAt: new Date().toISOString()
    };
    await db.insert('wounds', newWound);
    res.status(201).json(newWound);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Incidents ---
app.get('/api/incidents', async (req, res) => {
  try {
    const data = await db.get('incidents');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/incidents', async (req, res) => {
  try {
    const body = req.body;
    const count = (await db.get('incidents')).length + 1;
    const newIncident = {
      ...body,
      id: `inc-${count}`,
      reportedAt: new Date().toISOString(),
      occurredAt: body.occurredAt || new Date().toISOString(),
      witnesses: body.witnesses || [],
      correctiveActions: body.correctiveActions || []
    };
    await db.insert('incidents', newIncident);
    res.status(201).json(newIncident);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/incidents/:id', async (req, res) => {
  try {
    const updated = await db.updateById('incidents', req.params.id, () => req.body);
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Incident not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Audits ---
app.get('/api/audit-entries', async (req, res) => {
  try {
    const data = await db.get('auditEntries');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/audit-entries', async (req, res) => {
  try {
    const body = req.body;
    const count = (await db.get('auditEntries')).length + 1;
    const newEntry = {
      ...body,
      id: `aud-${count}`,
      ts: new Date().toISOString(),
      meta: body.meta || { ip: '127.0.0.1', ua: 'web' }
    };
    await db.insert('auditEntries', newEntry);
    res.status(201).json(newEntry);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Inventory ---
app.get('/api/inventory', async (req, res) => {
  try {
    const data = await db.get('inventory');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const body = req.body;
    const newItem = {
      ...body
    };
    await db.insert('inventory', newItem);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/inventory/:sku', async (req, res) => {
  try {
    const updated = await db.updateById('inventory', req.params.sku, () => req.body);
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Inventory item not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Family Updates ---
app.get('/api/family-updates', async (req, res) => {
  try {
    const data = await db.get('familyUpdates');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/family-updates', async (req, res) => {
  try {
    const { patientId, author, mood, note, photo } = req.body;
    if (!patientId || !author || !mood || !note) {
      return res.status(400).json({ error: 'Missing family update fields' });
    }

    const count = (await db.get('familyUpdates')).length + 1;
    const newUpdate = {
      id: `upd-${count}`,
      patientId,
      ts: new Date().toISOString(),
      author,
      mood,
      note,
      photo
    };

    await db.insert('familyUpdates', newUpdate);

    // Broadcast to WebSockets
    broadcast({
      type: 'new_family_update',
      payload: newUpdate
    });

    res.status(201).json(newUpdate);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Initialize database and start the server
db.init().then(() => {
  server.listen(port, () => {
    console.log(`CareVibe server listening on port ${port}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

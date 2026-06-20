const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Estado Global ────────────────────────────────────────────────────────────
let client = null;
let isReady = false;
let contacts = [];
let qrCodeData = null;
let sendingProgress = null;
let isSyncing = false;

// ─── Inicializar WhatsApp ─────────────────────────────────────────────────────
function initWhatsApp() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
  });

  client.on('qr', async (qr) => {
    try {
      qrCodeData = await qrcode.toDataURL(qr, { width: 256, margin: 2 });
      io.emit('qr', qrCodeData);
      io.emit('status', { status: 'qr', message: 'Escaneie o QR Code com seu WhatsApp' });
    } catch (err) {
      console.error('Erro ao gerar QR:', err);
    }
  });

  client.on('loading_screen', (percent, message) => {
    io.emit('status', { status: 'loading', message: `Carregando... ${percent}%` });
  });

  client.on('authenticated', () => {
    io.emit('status', { status: 'authenticated', message: 'Autenticado! Carregando...' });
  });

  client.on('ready', async () => {
    isReady = true;
    qrCodeData = null;
    const info = client.info;
    const phone = info ? info.wid.user : '';

    io.emit('status', { status: 'ready', message: 'Conectado!', phone });
    console.log('WhatsApp conectado!');

    syncContacts();
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    contacts = [];
    qrCodeData = null;
    isSyncing = false;
    io.emit('status', { status: 'disconnected', message: 'Desconectado. Reconectando...' });
    io.emit('contacts', []);
    console.log('Desconectado:', reason);
    setTimeout(() => initWhatsApp(), 5000);
  });

  client.on('auth_failure', () => {
    io.emit('status', { status: 'error', message: 'Falha na autenticação. Tente novamente.' });
  });

  client.initialize().catch(err => {
    console.error('Erro ao inicializar:', err);
    io.emit('status', { status: 'error', message: 'Erro ao inicializar WhatsApp.' });
  });
}

// ─── Sincronizar Contatos ─────────────────────────────────────────────────────
async function syncContacts() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    io.emit('sync_status', { syncing: true, message: 'Sincronizando contatos...' });

    const contactMap = new Map();

    // 1) Chats primeiro — rápido, pega salvos e não salvos
    io.emit('sync_status', { syncing: true, message: 'Buscando conversas...' });
    const chats = await client.getChats();

    for (const chat of chats) {
      if (!chat.isGroup && chat.id.server === 'c.us' && chat.id.user.length >= 10) {
        const id = chat.id._serialized;
        contactMap.set(id, {
          id,
          name: chat.name || `+${chat.id.user}`,
          number: chat.id.user,
          isSaved: false,
          lastSeen: chat.timestamp ? new Date(chat.timestamp * 1000).toISOString() : null
        });
      }
    }

    // Mostra parcial logo
    const partial = Array.from(contactMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (partial.length > 0) {
      contacts = partial;
      io.emit('contacts', contacts);
      io.emit('sync_status', { syncing: true, message: `${contacts.length} conversas carregadas. Buscando agenda...` });
    }

    // 2) Enriquece com agenda
    const allContacts = await client.getContacts();
    for (const contact of allContacts) {
      if (contact.isWAContact && !contact.isGroup && contact.id.server === 'c.us' && contact.id.user.length >= 10) {
        const id = contact.id._serialized;
        const existing = contactMap.get(id);
        const name = contact.name || contact.pushname || (existing ? existing.name : `+${contact.number}`);
        contactMap.set(id, {
          id,
          name,
          number: contact.number || contact.id.user,
          isSaved: contact.isMyContact || false,
          lastSeen: existing ? existing.lastSeen : null
        });
      }
    }

    contacts = Array.from(contactMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    io.emit('contacts', contacts);
    io.emit('sync_status', { syncing: false, message: `${contacts.length} contatos sincronizados!` });
    console.log(`Contatos sincronizados: ${contacts.length}`);
  } catch (err) {
    console.error('Erro ao sincronizar contatos:', err);
    io.emit('sync_status', { syncing: false, message: 'Erro na sincronização.' });
  } finally {
    isSyncing = false;
  }
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ isReady, contactsCount: contacts.length, isSyncing });
});

app.get('/api/contacts', (req, res) => {
  res.json(contacts);
});

app.post('/api/sync', async (req, res) => {
  if (!isReady) return res.status(400).json({ error: 'WhatsApp não conectado' });
  if (isSyncing) return res.json({ success: true, message: 'Sincronização já em andamento' });
  syncContacts();
  res.json({ success: true });
});

app.post('/api/send', async (req, res) => {
  if (!isReady) return res.status(400).json({ error: 'WhatsApp não conectado' });
  if (sendingProgress) return res.status(400).json({ error: 'Já existe um disparo em andamento' });

  const { contactIds, message, delay = 4000 } = req.body;

  if (!contactIds?.length || !message?.trim()) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  res.json({ success: true, total: contactIds.length, message: 'Disparos iniciados!' });

  sendingProgress = { sent: 0, failed: 0, total: contactIds.length };
  io.emit('send_start', { total: contactIds.length });

  for (let i = 0; i < contactIds.length; i++) {
    const contactId = contactIds[i];
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) continue;

      let personalizedMsg = message
        .replace(/\{nome\}/gi, contact.name.split(' ')[0] || 'amigo(a)')
        .replace(/\{nomeCompleto\}/gi, contact.name || 'amigo(a)')
        .replace(/\{numero\}/gi, contact.number || '');

      await client.sendMessage(contactId, personalizedMsg);
      sendingProgress.sent++;

      io.emit('send_progress', {
        sent: sendingProgress.sent,
        failed: sendingProgress.failed,
        total: sendingProgress.total,
        index: i,
        contact: contact.name
      });

      const randomDelay = delay + Math.floor(Math.random() * 2000);
      await new Promise(resolve => setTimeout(resolve, randomDelay));

    } catch (err) {
      sendingProgress.failed++;
      console.error(`Erro ao enviar para ${contactId}:`, err.message);
      io.emit('send_progress', {
        sent: sendingProgress.sent,
        failed: sendingProgress.failed,
        total: sendingProgress.total,
        index: i,
        error: true
      });
    }
  }

  io.emit('send_complete', {
    sent: sendingProgress.sent,
    failed: sendingProgress.failed,
    total: sendingProgress.total
  });

  sendingProgress = null;
});

// Desconectar — força imediatamente, não espera o cliente responder
app.post('/api/disconnect', async (req, res) => {
  isReady = false;
  contacts = [];
  qrCodeData = null;
  sendingProgress = null;
  isSyncing = false;
  res.json({ success: true });
  io.emit('status', { status: 'disconnected', message: 'Desconectado.' });
  io.emit('contacts', []);
  try {
    if (client) {
      await client.logout().catch(() => {});
      await client.destroy().catch(() => {});
    }
  } catch (err) {
    console.error('Erro ao desconectar:', err.message);
  }
  setTimeout(() => initWhatsApp(), 2000);
});

// Gera código de pareamento (alternativa ao QR Code)
app.post('/api/pairing-code', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Número obrigatório' });
  if (!client) return res.status(400).json({ error: 'Cliente não inicializado' });
  try {
    const code = await client.requestPairingCode(phone.replace(/\D/g, ''));
    res.json({ success: true, code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Cliente UI conectado:', socket.id);

  if (isReady) {
    socket.emit('status', {
      status: 'ready',
      message: 'Conectado!',
      phone: client?.info?.wid?.user || ''
    });
    socket.emit('contacts', contacts);
    socket.emit('sync_status', isSyncing
      ? { syncing: true, message: 'Sincronizando contatos...' }
      : { syncing: false, message: `${contacts.length} contatos sincronizados` });
  } else if (qrCodeData) {
    socket.emit('qr', qrCodeData);
    socket.emit('status', { status: 'qr', message: 'Escaneie o QR Code com seu WhatsApp' });
  } else {
    socket.emit('status', { status: 'connecting', message: 'Inicializando WhatsApp...' });
  }

  if (sendingProgress) {
    socket.emit('send_start', { total: sendingProgress.total });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Dispara Yuna rodando em http://localhost:${PORT}\n`);
  initWhatsApp();
});

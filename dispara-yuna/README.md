# 🚀 Dispara Yuna

Ferramenta de disparo de mensagens WhatsApp com sincronização automática de contatos.

## ✅ Funcionalidades
- Login via QR Code **ou** Código de pareamento
- Sincronização automática de contatos salvos e não salvos
- Seleção individual ou em massa de contatos
- Personalização com variáveis `{nome}`, `{nomeCompleto}`, `{numero}`
- Delay configurável entre mensagens
- Progresso em tempo real dos disparos

## ☁️ Deploy no Railway
1. Suba os arquivos para um repositório no GitHub (mantendo a estrutura de pastas)
2. No Railway: New Project → Deploy from GitHub repo
3. Se os arquivos estiverem em uma subpasta, configure o **Root Directory**
4. Em Settings → Networking → Generate Domain, escolha a porta **8080** ou a porta detectada como "node"

## 📁 Estrutura
```
dispara-yuna/
├── server.js
├── public/
│   └── index.html
├── package.json
├── Dockerfile
├── .dockerignore
├── .gitignore
└── README.md
```

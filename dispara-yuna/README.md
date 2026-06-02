# 🚀 Dispara Yuna

Ferramenta de disparo de mensagens WhatsApp com sincronização automática de contatos.

---

## ✅ Funcionalidades

- QR Code para vincular seu WhatsApp
- Sincronização automática de contatos salvos e não salvos
- Seleção individual ou em massa de contatos
- Personalização com variáveis `{nome}`, `{nomeCompleto}`, `{numero}`
- Delay configurável entre mensagens (para evitar bloqueio)
- Interface bonita e responsiva
- Progresso em tempo real dos disparos

---

## 💻 Rodar Localmente

### Pré-requisitos
- Node.js 18+
- Google Chrome instalado

### Instalação

```bash
# 1. Entre na pasta do projeto
cd dispara-yuna

# 2. Instale as dependências
npm install

# 3. Inicie o servidor
npm start
```

Acesse: **http://localhost:3000**

---

## ☁️ Deploy no Railway

### Passo a passo:

1. **Crie uma conta** em [railway.app](https://railway.app)

2. **Instale o Railway CLI** (opcional) ou use o painel web

3. **Faça o deploy via GitHub:**
   - Crie um repositório no GitHub e suba os arquivos
   - No Railway: `New Project → Deploy from GitHub repo`
   - Selecione o repositório
   - O Railway detecta o `Dockerfile` automaticamente ✅

4. **Acesse a URL gerada** pelo Railway (ex: `dispara-yuna.up.railway.app`)

### Via CLI:
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## ⚠️ Aviso Importante

Esta ferramenta usa a biblioteca `whatsapp-web.js` (não oficial).  
Use com responsabilidade:
- Evite disparar para centenas de contatos de uma vez
- Mantenha o intervalo mínimo de 4 segundos
- Não envie spam ou conteúdo indesejado
- Sua conta pode ser bloqueada pelo WhatsApp em caso de uso abusivo

---

## 📁 Estrutura do Projeto

```
dispara-yuna/
├── server.js          # Backend principal (Express + Socket.io + WhatsApp)
├── public/
│   └── index.html     # Interface web completa
├── package.json
├── Dockerfile         # Para deploy no Railway
├── .dockerignore
├── .gitignore
└── README.md
```

---

## 🛠️ Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT`   | Porta do servidor | `3000` |
| `PUPPETEER_EXECUTABLE_PATH` | Caminho do Chrome | auto |

No Railway, o `PORT` é definido automaticamente.

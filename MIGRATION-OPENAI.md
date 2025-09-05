# 🚀 Migração para OpenAI Realtime API

## 📋 Resumo da Migração

Este projeto agora suporta tanto **Gemini Live API** quanto **OpenAI Realtime API** para conversação por voz em tempo real. A OpenAI Realtime API oferece latência extremamente baixa (~500ms) e suporte nativo para português brasileiro.

## ✨ Principais Melhorias

### OpenAI Realtime API
- **Latência Ultra-baixa**: ~500ms tempo para primeira resposta
- **WebSocket Nativo**: Conexão persistente e bidirecional
- **6 Vozes Expressivas**: Incluindo "Nova" otimizada para português
- **Interrupção Inteligente**: Usuário pode interromper a IA naturalmente
- **Detecção de Fim de Frase**: Turnos de conversa automáticos
- **Function Calling**: Integração com ferramentas e ações

### Compatibilidade Mantida
- ✅ Formato de áudio compatível (PCM 16kHz entrada, 24kHz saída)
- ✅ Visualizações de áudio funcionam sem mudanças
- ✅ Análise de conteúdo continua usando Gemini
- ✅ Fallback automático para Gemini se necessário

## 🛠️ Configuração

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` baseado no `.env.example`:

```env
# OpenAI API Key (obrigatório para voz)
OPENAI_API_KEY=sk-...

# Gemini API Key (ainda necessário para análise de conteúdo)
GEMINI_API_KEY=...

# Provedor padrão de voz ('openai' ou 'gemini')
DEFAULT_VOICE_PROVIDER=openai

# Voz da OpenAI (alloy, echo, fable, onyx, nova, shimmer)
OPENAI_VOICE=nova

# (Opcional) URL do proxy WebSocket para Realtime
# No ambiente de desenvolvimento (Vite), já existe um proxy em /openai-realtime
# Para produção, configure um backend que encaminhe para api.openai.com/v1/realtime
# OPENAI_REALTIME_URL=/openai-realtime
```

### 3. Obter API Key da OpenAI

1. Acesse [platform.openai.com](https://platform.openai.com)
2. Crie uma conta ou faça login
3. Vá em API Keys → Create new secret key
4. **Importante**: A API Realtime está em beta e requer:
   - Tier 1+ na plataforma OpenAI
   - Créditos disponíveis na conta

## 📁 Arquivos Criados

### Novos Serviços
- `src/services/openai/openai-realtime-service.ts` - Cliente WebSocket para OpenAI
- `src/services/audio/openai-audio-adapter.ts` - Adaptador de áudio para OpenAI
- `src/components/main/index-openai.tsx` - Componente principal com suporte dual

### Configuração
- `.env.example` - Template de variáveis de ambiente
- `vite.config.ts` - Atualizado com novas variáveis

## 🎯 Como Usar

### Iniciar com OpenAI (Padrão)
```bash
npm run dev
```
O app iniciará usando OpenAI Realtime API por padrão.

No ambiente de desenvolvimento, as conexões WebSocket para Realtime passam por um
proxy do Vite em `/openai-realtime`, que injeta os headers de autorização usando
`OPENAI_API_KEY`. Isso contorna a limitação do navegador de não permitir headers
customizados em WebSockets.

### Alternar entre Provedores
O componente salva a preferência do usuário em localStorage. Para mudar:

1. Na interface, adicione um botão/switch para alternar
2. Ou via console: `localStorage.setItem('voice-provider', 'gemini')`

### Estrutura do Código

```typescript
// Usar OpenAI
import { OpenAIAudioAdapter } from './services/audio/openai-audio-adapter';

const adapter = new OpenAIAudioAdapter({
  apiKey: 'sk-...',
  voice: 'nova',
  instructions: 'Você é um assistente em português brasileiro',
  onTranscript: (text, type) => console.log(text),
  onError: (error) => console.error(error)
});

await adapter.connect();
await adapter.startRecording();
```

## 💰 Custos

### OpenAI Realtime API (Dezembro 2024)
- **Áudio Input**: $0.06 / minuto
- **Áudio Output**: $0.24 / minuto
- **Texto Input**: $5.00 / 1M tokens
- **Texto Output**: $20.00 / 1M tokens

### Comparação com Gemini
- Gemini Live geralmente mais econômico para uso contínuo
- OpenAI melhor para interações curtas de alta qualidade
- Considere híbrido: OpenAI para demos, Gemini para produção

## 🔧 Troubleshooting

### Erro: "WebSocket connection failed"
- Verifique se a API key está correta
- Confirme que tem créditos na conta OpenAI
- A API Realtime requer Tier 1+ 

### Erro: "AudioWorklet not supported"
- Use navegador moderno (Chrome 66+, Firefox 76+, Safari 14.1+)
- HTTPS necessário em produção

### Áudio cortando ou com delay
- Ajuste o buffer no `openai-audio-adapter.ts`
- Verifique conexão de internet (mínimo 1 Mbps)

## 🚦 Próximos Passos

1. **UI para Seleção de Provedor**: Adicionar toggle na interface
2. **Métricas de Performance**: Dashboard comparando latências
3. **Cache Inteligente**: Salvar respostas comuns localmente
4. **Function Calling**: Integrar ações via OpenAI
5. **Transcrição em Tempo Real**: Mostrar texto enquanto fala

## 📊 Comparação Técnica

| Feature | Gemini Live | OpenAI Realtime |
|---------|------------|-----------------|
| Latência | ~800-1200ms | ~500ms |
| Vozes PT-BR | Orus | Nova (melhor) |
| Preço/min | ~$0.02 | ~$0.30 |
| Interrupção | Manual | Automática |
| Busca Web | ✅ Nativa | Via Functions |
| Análise Docs | ✅ Excelente | ❌ Limitada |

## 🤝 Recomendações

### Use OpenAI Realtime quando:
- Latência é crítica (<600ms)
- Qualidade de voz é prioridade
- Interações curtas e focadas
- Demo ou apresentação

### Use Gemini Live quando:
- Custo é fator importante
- Sessões longas (>10 min)
- Precisa análise de documentos
- Busca web integrada

## 📝 Notas de Implementação

- WebSocket mantém conexão persistente (não HTTP requests)
- Áudio é streamado em chunks de 640 samples (40ms @ 16kHz)
- Buffer de saída mantido entre 200-350ms para equilíbrio
- Reconnect automático com backoff exponencial
- Estado da conversa mantido no servidor (stateful)

---

**Última atualização**: Janeiro 2025
**Versão da API**: OpenAI Realtime v1 (2024-12-17)

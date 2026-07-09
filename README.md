# 💚 Dois

> Um app web progressivo (PWA) para casais — planeje, organize e viva momentos juntos.

## Sobre o projeto

**Dois** é um web app feito para casais que querem ter um espaço compartilhado e organizado no celular. O app pode ser adicionado à tela inicial do iPhone (e Android) como se fosse um aplicativo nativo, sem precisar de App Store.

Este projeto foi desenvolvido por **[Luís Sborz](https://github.com/SborzL)** com auxílio do **Claude (Anthropic)** como assistente de desenvolvimento — desde a arquitetura do banco de dados até a implementação das funcionalidades.

## Funcionalidades

- 🔐 **Login e cadastro** — autenticação via e-mail e senha
- 💑 **Conexão de casal** — um gera um código, o outro digita e os dois ficam vinculados
- 📍 **Lugares** — salve restaurantes, cafés e passeios que vocês querem visitar
- 🎉 **Roleta** — sorteie um lugar para visitar
- ✅ **Checklists** — listas compartilhadas de coisas que querem fazer
- 📅 **Agenda** — marque encontros e eventos no calendário do casal
- 👤 **Perfil** — gerencie as informações do casal

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | HTML, CSS, JavaScript (Vanilla) |
| Banco de dados | [Supabase](https://supabase.com) (PostgreSQL) |
| Autenticação | Supabase Auth |
| Hospedagem | GitHub Pages |
| PWA | Web App Manifest + Apple meta tags |

## Como instalar no iPhone

1. Abra o link do app no **Safari**
2. Toque no botão de compartilhar (ícone de caixa com seta)
3. Selecione **"Adicionar à Tela de Início"**
4. Confirme o nome e toque em **Adicionar**

Pronto — o app aparece na sua tela inicial como se fosse nativo. 📱

## Estrutura do banco (Supabase)

```
couples          → registro do casal (com invite_code)
couple_members   → vincula usuários ao casal
places           → lugares salvos pelo casal
checklists       → listas criadas pelo casal
checklist_items  → itens de cada lista
events           → eventos/encontros na agenda
```

Todas as tabelas têm **Row Level Security (RLS)** ativo — cada casal só acessa os próprios dados.

## Rodando localmente

Como é um projeto estático (HTML/CSS/JS puro), basta abrir os arquivos em um servidor local. Recomendo a extensão **Live Server** no VS Code.

Não esqueça de criar seu próprio projeto no [Supabase](https://supabase.com) e atualizar o `supabase-client.js` com sua URL e chave anon.

---

Feito com 💚 por Luís Sborz · Brasília, Brasil

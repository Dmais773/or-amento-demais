# Orçamento Dmais - Versão Firebase

Esta versão já tem:

- Login com e-mail e senha usando Firebase Authentication.
- Produtos salvos por usuário no Firestore. Cada conta começa sem produtos de exemplo.
- Orçamentos salvos por usuário no Firestore.
- Histórico dos últimos 30 orçamentos de cada conta.
- Abrir, duplicar e excluir orçamento do histórico.
- Busca de equipamento digitando.
- Edição de item já adicionado: ambiente, quantidade e preço.
- Arrastar e soltar itens dentro do mesmo ambiente.
- Impressão / salvar em PDF pelo navegador.
- Download simples em Word `.doc`.

## Firebase usado

Projeto: `orcamento-dmais`

Regras esperadas no Firestore:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Como testar no computador

Por usar importação do Firebase por CDN, o ideal é abrir com um servidor local simples, e não apenas dando dois cliques no `index.html`.

Opção simples com Python:

```bash
cd mvp_sistema_orcamento
python -m http.server 8000
```

Depois abra no navegador:

```text
http://localhost:8000
```

## Como subir no GitHub Pages

1. Envie todos os arquivos para um repositório no GitHub.
2. Deixe o `index.html` na raiz do repositório.
3. Ative o GitHub Pages em `Settings > Pages`.
4. Escolha `Deploy from a branch`, branch `main`, pasta `/root`.

## Atenção sobre domínio autorizado

Se o login não funcionar no GitHub Pages, vá no Firebase:

`Authentication > Configurações > Domínios autorizados`

E adicione o domínio do GitHub Pages, por exemplo:

```text
seuusuario.github.io
```

## Sobre imagens

Nesta versão, o Firebase Storage não foi ativado porque pediu upgrade do plano. Por isso, imagens cadastradas manualmente são salvas no Firestore em formato base64. Use imagens pequenas, de preferência abaixo de 500 KB.

Para um sistema real com muitos produtos e imagens, o ideal depois é ativar Storage ou usar outro local para hospedar as imagens.

## Atualização visual

Versão com layout visual ajustado para ficar mais próximo da identidade da D+ Casa Shop:
- tela de login mais limpa;
- painel interno com cabeçalho verde;
- botões e campos com cores da marca;
- orçamento mantendo o formato de proposta, mas com acabamento mais agradável;
- sem alteração da lógica de login, histórico ou salvamento.


## Atualização desta versão

- Campo de observação geral da proposta no painel lateral.
- Observação aparece no PDF na página de condições da proposta.
- Numeração visual das páginas no layout de impressão/PDF.


## Ajuste v7

- Removido o botão “Carregar exemplo” da tela principal.
- Botão “Excluir equipamento selecionado” movido para abaixo dos botões de ação do item.
- A exclusão continua exigindo confirmação antes de apagar o equipamento do cadastro.

## Versão zerada para o cliente

Nesta versão, o sistema não cria produtos de exemplo automaticamente.

Cada conta começa vazia e o cliente cadastra os próprios equipamentos com nome, unidade, preço e imagem.

As imagens cadastradas continuam sendo salvas no Firestore em formato base64, dentro do próprio produto. O GitHub não recebe essas imagens.

## Ajuste v11

- Removido o botão “Zerar todos os equipamentos”.
- A exclusão individual de equipamento agora é o caminho principal: ao confirmar, o produto é apagado definitivamente do Firestore daquela conta.
- Produtos excluídos não são recriados automaticamente ao fazer login.
- Após excluir um produto, o campo de equipamento fica vazio para evitar confusão.

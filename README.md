# Orçamento Dmais - v17

Versão com **catálogo global de equipamentos** controlado pela conta ADM.

## Conta ADM

E-mail ADM configurado no sistema:

```text
orcamentodmais@gmail.com
```

## O que mudou

- Os equipamentos agora ficam em um **catálogo global** no Firestore.
- A conta ADM pode cadastrar, excluir e gerenciar os equipamentos.
- Todas as outras contas visualizam o mesmo catálogo global.
- Quando o ADM cadastra um equipamento, ele aparece para todos os usuários.
- Quando o ADM exclui um equipamento, ele deixa de aparecer para todos os usuários.
- Os orçamentos continuam independentes por usuário.
- Cada conta vê apenas os próprios orçamentos e histórico.

## Estrutura no Firestore

```text
catalogoGlobal
  └── principal
      └── produtos
          ├── produto 1
          ├── produto 2
          └── produto 3

usuarios
  └── ID_DO_USUARIO
      └── orcamentos
```

## Importante: atualizar regras do Firestore

Antes de publicar/testar esta versão, substitua as regras do Firestore pelo conteúdo do arquivo:

```text
firestore_rules_adm.txt
```

Sem essa alteração, o sistema não conseguirá carregar o catálogo global.

## Como publicar no GitHub Pages

1. Extraia este ZIP.
2. Envie para o repositório os arquivos e pastas extraídos:
   - index.html
   - assets/
   - README.md
   - firestore_rules_adm.txt
3. Aguarde o GitHub Pages atualizar.
4. Faça login com `orcamentodmais@gmail.com` para cadastrar os equipamentos do catálogo global.

## Observação sobre imagens

Como o Firebase Storage não foi ativado, as imagens dos equipamentos continuam sendo salvas dentro do documento do produto no Firestore. Use imagens leves para evitar erro de tamanho.

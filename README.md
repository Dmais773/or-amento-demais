# Orçamento Dmais

Sistema web para gerar orçamentos com login, cadastro de equipamentos, imagens, histórico e impressão/salvamento em PDF pelo navegador.

## Versão v12 - zerada

Esta versão começa sem equipamentos de exemplo e sem orçamento carregado.

- Cada conta começa vazia.
- O cliente cadastra os próprios equipamentos.
- Produtos, fotos e orçamentos ficam salvos no Firestore, separados por usuário.
- As imagens cadastradas ficam salvas junto ao produto no Firestore em base64.
- O GitHub guarda apenas o código do sistema, não os dados cadastrados.
- O PDF é gerado pelo navegador ao clicar em Imprimir / Salvar PDF.

## Firebase

Projeto configurado: `orcamento-dmais`

## Observação

Como o Firebase Storage não está ativado, use imagens pequenas nos equipamentos.

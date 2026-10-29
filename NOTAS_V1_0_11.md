# PreçoCerto v1.0.11 — Avatar e Enter

Atualização incremental para a v1.0.10 (sem alterar dados do Firebase).

- Avatar padrão com ícone de pessoa quando não há foto ou ela não carrega.
- Ao escolher uma nova foto, ela substitui automaticamente o padrão.
- Enter envia login, cadastro, recuperação de senha, edição de produtos, perfis de taxas, dados pessoais e alteração de senha.
- Os botões auxiliares dentro de formulários usam `type="button"`, evitando envios acidentais.
- Confirmações destrutivas de exclusão/backup continuam exigindo confirmação explícita.
- Testes automatizados de regressão para estes fluxos.

## Testes após instalar

1. Conta sem foto: avatar genérico no menu lateral, no mobile e na tela Meu perfil.
2. Imagem inválida: aparece o genérico, sem ícone quebrado.
3. Foto válida: aparece normalmente e pode ser enquadrada.
4. Tela login: digitar e-mail/senha e usar Enter; repetir no cadastro e recuperação.
5. Produtos e perfis: editar, digitar em um campo e usar Enter para salvar.
6. Meu perfil e Segurança: Enter confirma somente os formulários ativos.

O patch cria um backup local do código e tenta reverter em caso de falha nos testes/build.

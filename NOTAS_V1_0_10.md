# PreçoCerto v1.0.10 — Performance e segurança

## O que mudou

- **Carregamento sob demanda**: autenticação e área autenticada têm arquivos JS separados.
- **Firestore pós-login**: o código do banco só é carregado quando a conta precisa dele.
- **Autossalvamento e restauração**: uma restauração espera gravações já iniciadas para não ser substituída por uma gravação antiga.
- **Cabeçalhos de segurança Netlify**: `nosniff`, proteção contra frame, política de referenciador e permissões mínimas.
- **Sem mudar a interface nem os cálculos**: preservadas as funcionalidades e regras atuais.

## Proteções e limites

- A atualização não modifica `.env.local`, senhas, configuração do Firebase ou dados já salvos.
- As regras do Firestore aplicadas pelo Console não são alteradas por esse patch.
- O Firebase Auth e as regras de acesso por UID continuam sendo as fronteiras de segurança.
- Cabeçalhos HTTP reduzem superfícies comuns, mas não substituem auditoria de autenticação e regras.

## Validação

1. Execute `npm.cmd test` e `npm.cmd run build`.
2. Abra a aplicação e teste login por e-mail, Google e sair; teste a conta de demonstração.
3. Confira catálogo, cálculos, exportação/importação e persistência após F5 em conta de teste.
4. Confira no Netlify se a publicação terminou como **Published**.
5. Publique no GitHub apenas após validar o ambiente local.

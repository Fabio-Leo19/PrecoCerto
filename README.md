# PreçoCerto

Uma calculadora de preços para quem vende produtos e precisa saber, sem adivinhações, quanto vai sobrar de lucro. Nasceu como um protótipo no Figma Make; esta versão conserva o visual original e acrescenta os cálculos, o catálogo, o cadastro e a persistência necessários para transformá-lo em um aplicativo web.

## O que funciona

- Painel com nome e foto atualizados conforme o perfil, indicadores, margens e produtos a revisar.
- Calculadora com custo de aquisição, embalagem, frete, operação, taxas, impostos e descontos; preço sugerido e ponto de equilíbrio.
- Cadastro, edição, duplicação e exclusão de produtos; filtros, perfis de taxas e cenários de simulação.
- Interface responsiva para computador e celular.
- Demonstração independente de serviços externos, com nome, foto e dados salvos no navegador.
- **Firebase Authentication**: cadastro e login reais com e-mail/senha, login Google, confirmação por e-mail, alteração de senha e recuperação por e-mail.
- **Cloud Firestore**: catálogo, cálculos e perfil de cada conta salvos em documentos separados por usuário, com regras de acesso incluídas.
- Foto JPG/PNG/WebP de até 3 MB no envio, reduzida para um pequeno avatar WebP antes de ser gravada no perfil do Firestore. Inclui zoom e enquadramento.
- Telefone com máscara automática `(11) 99999-9999`; salvo como contato **não verificado**.
- Exportação e importação de **backup JSON** de produtos, perfis de taxas e simulações em **Perfis de taxas → Seu backup, nas suas mãos**. Faça isso periodicamente.

> O **modo demonstração funciona imediatamente**. O login e o banco de dados reais **dependem de você criar um projeto Firebase gratuito, habilitar os serviços e preencher as variáveis**. Nenhum dado foi enviado a uma conta Firebase durante a preparação deste código. **SMS real não está incluído no plano Spark sem cobrança** e está explicitamente desabilitado na interface.

## 1. Rodar no computador

Instale o **Node.js 24** (ou uma versão compatível recente) e abra o PowerShell na pasta que contém `package.json`:

```powershell
npm.cmd install
npm.cmd run dev
```

Abra o endereço mostrado pelo Vite (normalmente `http://localhost:5173`). Clique em **Explorar a demonstração sem cadastro** para testar imediatamente.

Para conferir o projeto:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

## 2. Criar o Firebase — plano Spark gratuito

1. Abra [Firebase Console](https://console.firebase.google.com/) e crie um projeto. Selecione **Spark** (sem cobrança). Não é preciso ativar o Blaze para os recursos de e-mail/Google/Firestore usados aqui.
2. Nas **Configurações do projeto**, adicione um aplicativo **Web** (`</>`) e copie os valores de `firebaseConfig`: `apiKey`, `authDomain`, `projectId` e `appId`.
3. Em **Authentication → Sign-in method**, habilite **E-mail/senha** e **Google**. Para o Google, siga a tela de configuração e selecione o e-mail de suporte solicitado. Em **Authentication → Settings → Password policy**, configure o modo **Require (Exigir)** com mínimo de **8 caracteres**. Não marque maiúscula, minúscula, número ou símbolo como obrigatórios: no PreçoCerto são apenas recomendações exibidas na barra de força. Isso mantém a mesma regra no serviço e na interface.
4. Em **Authentication → Settings → Authorized domains**, cadastre o domínio de produção, por exemplo `seu-site.netlify.app`. Para testar localmente, confirme que `localhost` aparece na lista; caso contrário, adicione-o.
5. Em **Firestore Database**, crie um banco Cloud Firestore (edição Standard) e escolha conscientemente a região. Na aba **Rules**, substitua as regras pelo conteúdo completo do arquivo [`firestore.rules`](firestore.rules) e clique em **Publish**. Não deixe o Firestore em modo público/de teste.
6. Copie `.env.example` como `.env.local` na raiz e preencha:

```dotenv
VITE_FIREBASE_API_KEY=SUA_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef012345
```

7. Reinicie o Vite depois de salvar `.env.local`. Faça uma conta de teste, confirme o link recebido por e-mail, entre, crie um produto e atualize a página para conferir a persistência. Teste depois outro usuário: ele **não deve** enxergar os dados da primeira conta.

**Atenção:** os identificadores `VITE_FIREBASE_*` são a configuração **pública do aplicativo Web**. A proteção real dos dados fica no Authentication e nas regras do Firestore. **Nunca coloque chaves do Admin SDK, arquivos de conta de serviço, tokens privados ou senhas em variáveis `VITE_`.** Não compartilhe `.env.local` no GitHub.

### E-mail, recuperação e o requisito de senha com 8 caracteres

O aplicativo exige **no mínimo 8 caracteres** ao cadastrar, redefinir ou alterar senhas. Maiúsculas, minúsculas, números e símbolos são recomendações exibidas no medidor, não requisitos bloqueantes. Ao se cadastrar, a pessoa precisa confirmar o e-mail; caso não receba, uma tentativa de login com e-mail/senha solicita outro link, sujeita aos limites do Firebase.

Em **Esqueceu sua senha? → Recuperar por e-mail**, o Firebase envia o link de recuperação. Por padrão, o link abre a **página segura hospedada pelo próprio Firebase**. Se quiser que ele abra **a tela de nova senha do PreçoCerto**, configure em **Authentication → Templates → qualquer modelo de e-mail → Customize action URL** a URL publicada do seu site, por exemplo `https://seu-site.netlify.app/`. **Essa configuração muda o destino de todos os modelos de e-mail do projeto**, não apenas o reset. Por isso esta versão reconhece `mode=resetPassword`, `mode=verifyEmail` e `mode=recoverEmail` junto ao `oobCode`, oferecendo telas para os três tipos de ação. No reset interno, a nova senha precisa obedecer aos mesmos requisitos de oito caracteres. Sem a personalização, a redefinição funciona pela página padrão do Firebase, cujos requisitos visuais são gerenciados pelo provedor.

O login Google também depende do domínio autorizado; navegadores podem solicitar permissão para abrir a janela de login.

### Por que não há SMS nesta versão gratuita?

O Firebase Phone Authentication para envio real de SMS requer o **plano Blaze com cobrança habilitada**. Para manter o PreçoCerto inteiramente no Spark, o telefone pode ser informado e formatado no perfil, mas **não serve para recuperar conta nem é marcado como verificado**. A opção de recuperação por SMS aparece desabilitada com uma explicação. Não há código fictício nem promessa de envio.

### Foto de perfil sem Firebase Storage

Para não precisar habilitar cobranças do Cloud Storage, o sistema comprime a imagem em tamanho pequeno e guarda a representação da foto no **documento privado do perfil no Firestore**. Isso funciona para avatar pequeno; não é adequado para galeria de arquivos nem imagens grandes. A imagem continua salva quando o usuário faz login novamente. Se a imagem for muito pesada para essa solução, é rejeitada antes do envio.

## 3. Publicar na Netlify

Envie a pasta de código a um repositório GitHub e importe na Netlify:

| Configuração | Valor |
| --- | --- |
| Comando de build | `npm run build` |
| Pasta publicada | `dist` |
| Diretório base | Vazio, se o repositório contém `package.json` na raiz |
| Node | `24` |

Em **Environment variables** da Netlify, adicione os mesmos quatro `VITE_FIREBASE_*` utilizados em `.env.local`, e **refaça o deploy**. A compilação incorpora esses valores públicos; um `dist` criado **antes** de configurá-los permanece em modo demonstração.

O arquivo `public/_redirects` evita erros ao carregar as rotas do aplicativo. Cadastre o domínio publicado no Firebase Authentication antes de testar o Google.

## 4. Backup, limites e segurança

- Faça backup regularmente no botão **Exportar meus dados**, disponível na tela **Perfis de taxas**. Esse arquivo contém catálogo, taxas e simulações, **não** senhas nem tokens da conta. Armazene com cuidado porque pode conter dados comerciais.
- O botão **Importar backup** substitui o catálogo atual da conta após confirmação. Ele funciona entre demonstração e contas reais.
- Firebase Spark tem **cotas de uso e armazenamento**; não é serviço ilimitado nem oferece todas as rotinas avançadas de backup gerenciado. A exportação manual não substitui um plano de contingência adequado a uma empresa.
- O Firebase Auth armazena credenciais; **nunca armazenamos senhas** no Firestore nem no localStorage do protótipo.
- `firestore.rules` permite acesso apenas ao próprio usuário com e-mail confirmado e aos documentos `profile` e `workspace` desse usuário. A interface não altera regras de segurança; elas precisam ser publicadas no Console.
- As sessões são mantidas pelo Firebase Auth. O modo demonstração utiliza somente o armazenamento do navegador e pode desaparecer se esses dados forem apagados.
- A mudança do Supabase para Firebase **não importa automaticamente** dados de projetos Supabase anteriores. Se houver dados reais lá, é necessária uma migração separada.
- A integração com Firebase depende de configuração externa e **deve ser testada** com contas reais e as regras publicadas. Os testes locais verificam o código e os cálculos, não o envio de e-mails do seu projeto.

## Como os cálculos funcionam

`receita líquida = preço de venda − desconto`

`custos fixos = aquisição + embalagem + frete + operação + tarifa fixa`

`taxas percentuais = receita líquida × (comissão + impostos) ÷ 100`

`lucro = receita líquida − custos fixos − taxas percentuais`

`margem = lucro ÷ receita líquida × 100`

`preço para a meta = desconto + (custos fixos + lucro desejado) ÷ (1 − percentual total de taxas)`

Quando a soma percentual chega a 100% ou mais, não é possível calcular um preço válido para essa meta. Os cálculos são **estimativas** e devem ser revisados conforme as taxas e os tributos reais do negócio.

## Estrutura principal

```text
src/
  App.tsx              Interface, rotas internas, perfil e backup
  index.css            Estilo responsivo do PreçoCerto
  lib/
    firebase.ts        Inicialização opcional e mensagens de erro
    account.ts         Autenticação, perfil, Google, e-mail e avatar
    workspace.ts       Catálogo e dados isolados por usuário, backup
    phone.ts           Máscara e normalização de telefone brasileiro
    pricing.ts         Cálculos de preço e margem
firestore.rules        Regras de acesso por conta (publicar no Console)
firebase.json         Referência das regras para quem usar Firebase CLI
tests/                Testes de cálculo e máscara
public/_redirects     Redirecionamento SPA para Netlify
```

O código está pronto para ser ligado a **um projeto Firebase seu**, mas continua funcionando como demonstração até essa configuração. Prefiro deixar isso explícito — assim você sabe exatamente o que está validado e o que ainda depende de ativação externa.

## Observações sobre escopo

A solução usa Firebase direto no navegador com regras privadas por UID; **não existe um servidor Node.js próprio** nesta versão. A integração real de e-mails e Google só pode ser validada após você configurar um projeto Firebase. SMS, billing e backups automáticos do Firebase não estão incluídos no Spark. O JSON exportado é um backup manual; guarde o arquivo em local seguro. Os dados de catálogo são armazenados em um único documento por usuário, portanto o limite de tamanho de documento do Firestore restringe catálogos grandes; uma evolução futura pode separar produtos em documentos individuais.

### Versão 1.0.4

Esta distribuição contém o **código-fonte**; a pasta `dist` é gerada com `npm.cmd run build` depois de instalar as dependências. O ambiente usado para empacotar não conseguiu baixar o SDK para repetir o build completo, portanto o primeiro teste de compilação deve ser feito no seu computador. Os **9 testes unitários locais** (precificação, máscara de telefone e política mínima de senha) passaram.

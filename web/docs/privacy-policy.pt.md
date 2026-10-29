# Política de Privacidade

Última atualização: 22 de outubro de 2026

O Platho é um mensageiro sem backend. Este documento é curto porque há muito
pouco a divulgar — e é específico onde algo realmente sai do seu dispositivo.

## O que recolhemos

Nada.

Não existe nenhum servidor do Platho. A aplicação é uma página estática que corre
inteiramente no seu navegador. Não operamos qualquer sistema de contas, qualquer
base de dados de utilizadores, qualquer análise de utilização, qualquer relatório
de falhas nem qualquer publicidade. Não podemos ver as suas mensagens, os seus
contactos, o seu saldo ou a sua atividade, porque nada disso nos é enviado.

Não pedimos endereço de e-mail, número de telefone nem nome.

## O que permanece no seu dispositivo

- A sua frase de recuperação de 24 palavras e as chaves de carteira e de mensagens dela derivadas.
- O seu histórico de mensagens. (Um rascunho que você não enviou fica só na memória e some quando a página fecha.)
- Os nomes que você dá aos seus contatos, e quais deles você fixou ou deixou de marcar como não lidos.
- Os nomes que você dá às suas carteiras — guardados como texto comum, para que a tela de bloqueio possa mostrá-los antes de qualquer senha.
- As suas definições, incluindo uma chave de API opcional de um fornecedor público de nós TON.

Nada disso chega até nós, e a proteção não é a mesma para cada item — por isso
cada um é nomeado separadamente, em vez de uma única afirmação para todos:

- **A frase de recuperação e as chaves derivadas dela** são cifradas com uma senha
  que você escolhe (AES-GCM-256, derivação de chave PBKDF2-SHA-256). Sem essa
  senha não podem ser lidas, nem por nós nem por quem estiver com o dispositivo.
  Se um gerenciador de senhas guarda essa senha para você, a carteira neste dispositivo
  fica tão protegida quanto esse gerenciador — em geral, a sua conta no dispositivo e,
  se ele sincroniza, a nuvem dele.
- **O histórico de mensagens, as chaves das suas conversas e grupos, os nomes que você dá aos seus contatos e o registro de quem escreveu para você primeiro**
  são cifrados com chaves derivadas da sua frase de recuperação. Essas chaves só
  existem enquanto a sua carteira está desbloqueada e nunca são gravadas no
  dispositivo; por isso, uma cópia dos arquivos do navegador — um backup, uma
  imagem de disco, outra conta no mesmo computador — não lê nada disso sem a sua
  senha: nem as mensagens, nem as chaves, nem os nomes. Num dispositivo que guarda a sua carteira, o mesmo vale para o que o app mantém para mostrar rapidamente imagens, perfis e publicações, e para os canais públicos que você segue e até onde você os leu.
- **As configurações** — tema, idioma — são guardadas como texto comum, e nada disso chega até nós. Do mesmo modo ficam
  os canais públicos que você segue e até onde você os leu num dispositivo sem carteira, até que uma seja criada ou
  restaurada nele. O único segredo entre elas, a chave de API opcional de um provedor de nós, é
  selada com uma chave que o seu navegador mantém neste dispositivo, em vez de ser
  guardada como texto simples.

Limpar os dados do navegador apaga tudo isso do dispositivo. O que a sua frase
de recuperação consegue trazer de volta vem da blockchain: as suas mensagens
estão publicadas lá, e as chaves que abrem as suas conversas e grupos, as suas
notas e as suas assinaturas também ficam lá, criptografadas com uma chave
derivada da frase — sem ela ninguém, nem nós, consegue lê-las ou restaurá-las.
Dentro do Telegram você pode guardar mais uma cópia, descrita abaixo em Telegram
Mini App: uma cópia criptografada da sua carteira que a limpeza dos dados do
navegador não alcança.

## O que é público por conceção

**As mensagens privadas são cifradas no seu dispositivo** antes de serem
publicadas, e apenas o destinatário pretendido pode ler o seu conteúdo.

**As publicações públicas não são cifradas.** São escritas na blockchain TON em
texto simples e são permanentes: nem nós, nem um administrador, nem um governo,
nem você como autor as pode remover. Não publique publicamente nada que possa vir
a precisar de retirar.

A blockchain é um registo público. Mesmo no caso das mensagens cifradas, o facto
de ter ocorrido uma transação, a sua hora e o seu custo são visíveis para
qualquer pessoa. Os endereços de carteira são públicos. Se associar um endereço à
sua identidade noutro lugar, a atividade desse endereço pode ser associada a si.

**Denúncias e reações são transações públicas da sua carteira.** Quando denuncia
um post ou reage a ele, a transação é enviada pela sua carteira para um endereço
que qualquer pessoa pode calcular a partir do post, por isso qualquer pessoa —
inclusive o autor desse post — pode ver qual carteira denunciou ou reagiu. Uma
denúncia rejeitada e uma sanção retirada desfazem o seu efeito, não o registo: a
transação permanece na cadeia para sempre.

## Terceiros que o seu dispositivo contacta

A aplicação não tem qualquer servidor nosso com que comunicar, pelo que comunica
diretamente com a infraestrutura pública da TON. Quando usa o Platho, o seu
navegador envia pedidos para:

- `toncenter.com`
- `tonapi.io`
- `nft.fragment.com`

Estes fornecedores veem necessariamente o seu endereço IP e os pedidos que o seu
dispositivo faz, e operam ao abrigo das suas próprias políticas de privacidade,
que não controlamos. Tirando o que você escolher guardar no Telegram (veja
Telegram Mini App abaixo), este é o único ponto em que informação sobre você sai do seu
dispositivo para uma parte que não seja a própria blockchain. Se usar uma VPN ou
a rede Tor, é isso que estes fornecedores veem.

Se fornecer a sua própria chave de API para um destes fornecedores, ela é
guardada no seu dispositivo e enviada apenas para esse fornecedor — e, se você
guardar a sua carteira no Telegram, também fica guardada lá, criptografada, ao
lado da cópia da carteira (veja abaixo).

## Telegram Mini App

O Platho também pode correr dentro do Telegram como um Mini App. Nesse modo, é o
próprio Telegram que determina o que disponibiliza à aplicação e o que regista
sobre a sua utilização do Telegram; isso é abrangido pela política de privacidade
do próprio Telegram, não por esta.

Nesse modo, a sua carteira fica em um de dois lugares, e você escolhe qual em
Configurações → «Onde a carteira fica guardada». **Por padrão, ela fica só neste
dispositivo**: nenhuma cópia dela é enviada ao Telegram (só as pequenas marcas
descritas abaixo), e, se os dados do dispositivo se perderem — o Telegram pode
apagar o armazenamento de um aplicativo, principalmente no iPhone —, só as suas
24 palavras ou o seu arquivo de chave a trazem de volta.

**Se você escolher guardá-la no Telegram, uma cópia criptografada da sua
carteira fica guardada no armazenamento em nuvem do Telegram** (CloudStorage),
para que qualquer dispositivo conectado à sua conta do Telegram possa abri-la
com a sua senha. A cópia é o mesmo registro criptografado com a sua senha que
fica no seu dispositivo: a frase de recuperação e o endereço da carteira estão
dentro da criptografia. Ao lado deles ficam os parâmetros necessários para
descriptografá-la e um identificador derivado da frase de recuperação, pelo qual
o app reconhece a própria cópia; sem a frase, esse identificador não pode ser
ligado ao seu endereço (o seu arquivo de chave o traz ao lado do endereço). O
Telegram guarda a cópia nos servidores dele e a associa à sua conta do Telegram;
sem a sua senha ela não pode ser descriptografada, então escolha uma senha forte
que você não use em nenhum outro lugar. Se você forneceu uma chave de API de um
provedor de nós, ela fica guardada ao lado da cópia, criptografada com uma chave
derivada da sua frase de recuperação. Cada cópia também traz um número de versão, pelo qual o aplicativo sabe qual cópia é mais recente, e uma assinatura feita com uma chave derivada da frase de recuperação, pela qual o aplicativo verifica que a cópia e a versão dela vêm da sua carteira.

Cada carteira que você guarda no Telegram tem lá a sua própria cópia, criptografada com a senha dessa carteira; criar ou escolher outra carteira num dispositivo não apaga nenhuma delas. Todo dispositivo conectado à sua conta do Telegram lista as carteiras guardadas lá — na tela de bloqueio e em Configurações → «Outras carteiras» —, e cada uma abre com a própria senha. Quando a senha de uma carteira muda, a cópia dela no Telegram recebe a nova. As carteiras usadas antes num dispositivo ficam guardadas nele do mesmo jeito.

Alguns valores pequenos também ficam na nuvem do Telegram: um aviso de que você
fechou o início rápido, uma marca de que você confirmou as 24 palavras de uma
carteira e, enquanto o arquivo de chave de uma carteira não tiver sido salvo, um
marcador; a marca e o marcador só podem ser reconhecidos por essa carteira.
Nenhum deles contém um endereço. O app só grava na nuvem do Telegram quando o
Telegram confirma que ele foi aberto pelo bot oficial @PlathoBot. Quando o
Telegram guarda uma cópia de uma carteira, o nome que você dá a ela fica
guardado ao lado, criptografado com uma chave derivada da frase de recuperação
dessa carteira — o Telegram não consegue lê-lo — e é apagado junto com a última
cópia lá.

«Apagar a cópia no Telegram» apaga a cópia da sua carteira lá e a chave de API guardada ao lado dela; «Esquecer esta carteira» apaga uma carteira de «Outras carteiras» neste dispositivo e a cópia dela no Telegram. A opção «Limpar dados locais» do próprio aplicativo limpa só este dispositivo — não apaga nada do Telegram —, e limpar o cache do Telegram ou os dados do navegador deixa as cópias no Telegram onde estão. Fora do Telegram, a carteira não é copiada para lugar nenhum.

## Crianças

O Platho não se destina a crianças com menos de 13 anos.

## Alterações

Se esta política for alterada, a data no topo é alterada com ela. A versão atual é
sempre a que está publicada na aplicação e em platho.app.

## Idioma

Este documento é publicado em várias línguas. As traduções são fornecidas por conveniência;
se divergirem, é a versão em inglês que prevalece.

## Contacto

Questões sobre esta política: https://t.me/plathoapp

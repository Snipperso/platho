# Política de Privacidade

Última atualização: 18 de agosto de 2026

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
- O seu histórico de mensagens e os seus rascunhos.
- As suas definições, incluindo uma chave de API opcional de um fornecedor público de nós TON.

Estes dados são guardados no armazenamento local do seu navegador e são cifrados
com uma palavra-passe à sua escolha (AES-GCM-256 com derivação de chave
PBKDF2-SHA-256). Nunca os recebemos. Limpar os dados do navegador apaga-os e, sem
a sua frase de recuperação, não podem ser restaurados por nós nem por mais
ninguém.

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

## Terceiros que o seu dispositivo contacta

A aplicação não tem qualquer servidor nosso com que comunicar, pelo que comunica
diretamente com a infraestrutura pública da TON. Quando usa o Platho, o seu
navegador envia pedidos para:

- `toncenter.com`
- `tonapi.io`
- `mainnet-v4.tonhubapi.com`

Estes fornecedores veem necessariamente o seu endereço IP e os pedidos que o seu
dispositivo faz, e operam ao abrigo das suas próprias políticas de privacidade,
que não controlamos. Este é o único ponto em que informação sobre si sai do seu
dispositivo para uma parte que não seja a própria blockchain. Se usar uma VPN ou
a rede Tor, é isso que estes fornecedores veem.

Se fornecer a sua própria chave de API para um destes fornecedores, ela é
guardada localmente no seu dispositivo e enviada apenas para esse fornecedor.

## Telegram Mini App

O Platho também pode correr dentro do Telegram como um Mini App. Nesse modo, é o
próprio Telegram que determina o que disponibiliza à aplicação e o que regista
sobre a sua utilização do Telegram; isso é abrangido pela política de privacidade
do próprio Telegram, não por esta.

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

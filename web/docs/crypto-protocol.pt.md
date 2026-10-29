# Criptografia do Platho

## Chaves e identidade

Tudo deriva de uma única frase semente: a chave da carteira, a de assinatura, a de cifragem e a de varredura. As metades secretas nunca saem do seu dispositivo — não são conhecidas por servidor nenhum, porque servidor não existe, nem pela rede.

Para a cadeia vão apenas as metades públicas, guardadas no seu KeyShard, cujo endereço está vinculado ao endereço da sua carteira. O fragmento só pode conter aquilo que essa carteira registou — o vínculo pelo endereço é toda a autorização. Guardam-se quatro campos: a chave de cifragem, a de assinatura, a de varredura e o número da geração de chaves.

O identificador de chave não é atribuído, é **calculado**: `keyId = H(chave de cifragem, hash da chave ML-KEM)`. Para apresentar o keyId de outra pessoa seria preciso a chave de cifragem dela.

A ativação é a primeira publicação das suas chaves públicas. Ela envia 0,06 GRAM da carteira para o seu KeyShard, que fica com o que o registro e o armazenamento exigem e devolve o resto. Para começar, a carteira precisa ter 0,07 GRAM: cada envio reserva 0,01 GRAM para as taxas de rede.

## Primeiro contacto

Uma primeira carta a um desconhecido não pode apoiar-se num segredo partilhado — ele ainda não existe. Por isso segue por uma faixa própria.

**Como o destinatário a encontra.** A parte pública da cápsula ocupa 42 bytes: um ponto aleatório `R` e uma etiqueta `view_tag` de dois bytes. A etiqueta é calculada a partir de `R` e da chave de **varredura** do destinatário. Ele percorre as entradas recentes e confere a etiqueta com a sua própria chave; quem olha de fora vê apenas bytes aleatórios e não consegue dizer a quem a carta se dirige. O endereço do destinatário não consta da parte pública.

**Como o destinatário sabe quem escreve.** O corpo cifrado transporta um aperto de mão criptográfico: a assinatura do remetente sobre uma transcrição que vincula ambos os keyId, a chave estática de cifragem do remetente, o hash da sua chave ML-KEM, os dois textos cifrados KEM, `R`, a `view_tag` e um número de uso único. A assinatura é verificada **antes** de qualquer campo ser aceite como verdadeiro — caso contrário, um atacante poderia enxertar a assinatura alheia sobre o seu próprio material de chaves.

Bastam duas verificações, e nenhuma exige leitura da cadeia:

1. o `keyId` é recalculado a partir das chaves apresentadas e tem de coincidir com o declarado;
2. uma etiqueta de confirmação prova que o remetente **derivou a mesma chave raiz**, o que exige o segredo por trás da chave de cifragem.

A primeira obriga o falsificador a usar a chave da vítima; a segunda apanha-o precisamente aí: não conseguirá derivar a raiz, a etiqueta não bate certo e a carta é rejeitada.

Uma repetição byte a byte é apanhada pelo número de uso único do aperto de mão.

As entradas de primeiro contacto vivem uma semana na cadeia — o suficiente para serem lidas, insuficiente para se tornarem arquivo.

## Uma conversa estabelecida

Depois do primeiro contacto os dois lados partilham uma chave raiz, e toda a correspondência seguinte passa para uma segunda faixa, que não diz absolutamente nada sobre quem conversa.

```
K_root  = HKDF( X25519(a,B) ‖ segredo partilhado ML-KEM-768,  info = ROOT ‖ keyId menor ‖ keyId maior )
K_epoch = HKDF( K_root,  info = RATCHET ‖ número da época )
bucket  = HKDF( K_epoch, info = BUCKET ‖ sentido ‖ número da época )
```

A raiz é híbrida: entram nela tanto o X25519 clássico como um encapsulamento ML-KEM-768 genuíno e aleatorizado. É nisso que consiste a robustez pós-quântica — a raiz não cai perante um computador quântico apontado apenas ao X25519.

Uma época é um dia UTC. Cada sentido da conversa escreve no **seu próprio** `bucket` opaco, que só quem conhece a raiz consegue calcular. A parte pública da cápsula tem 40 bytes e contém esse `bucket` e mais nada: nem remetente, nem destinatário, nem referência à mensagem anterior. Quem tentar montar um índice vê 32 bytes uniformemente aleatórios, impossíveis de atribuir a alguém.

## A cápsula

O corpo é cifrado com um híbrido de X25519 e ML-KEM-768, sob cifragem autenticada. A identidade do remetente (chave de assinatura, versão do perfil, impressão digital do avatar) fica **dentro** do texto cifrado, não na parte pública.

Cada cápsula tem uma classe de tamanho fixa, de 1 a 32 KB. O tamanho é arredondado para cima, por isso o comprimento de uma entrada nada diz sobre o comprimento da mensagem. O que exceder é dividido por várias cápsulas.

## O mural público

Publicações e comentários públicos **não são cifrados** — é para isso que servem. Ficam num PublicShard em texto aberto, e o contrato considera autor quem envia a transação, pelo que a carteira do autor fica visível.

Os comentários vivem num fragmento separado, cujo endereço deriva das coordenadas da publicação.

## Pagamento

Não há intermediário: o cliente assina ele próprio a mensagem externa e paga a partir da sua própria carteira. Nenhum retransmissor, nenhum custodiante e nenhuma parte de confiança pelo meio. Desde a passagem para os contratos atuais (2026-10-04), uma mensagem privada passa pelo FeeVault do próprio remetente — um contrato que só o seu dono controla, que guarda uma pequena reserva para a sua renda e os ATH que o dono bloqueou — que a encaminha para o shard. Mais ninguém pode gastar dele, e o seu dono pode retirar fundos dele.

A taxa do protocolo é de 0,01 GRAM por cápsula. Os ATH bloqueados no vault reduzem-na de 1% a 100%: em cada mensagem privada, cuja única porta é o vault, e em publicações, comentários e avatares quando o desconto supera a etapa extra pelo vault (numa publicação curta, a partir de cerca de 1.000 ATH); um primeiro contacto e um anúncio do diretório pagam-na sempre por inteiro. O resto do preço de uma publicação é o que a rede cobra pelo gás e pelo armazenamento. Publicar em público está sujeito a uma moderação aberta: os moderadores designados pelo conselho podem ocultar uma publicação ou restringir uma carteira, e os clientes que seguem o registo de moderação respeitam-no; as mensagens privadas não são afetadas.

## Recuperação

As chaves das conversas ficam no dispositivo sob uma chave que nunca sai dele. Isso sobrevive a um recarregamento e é inútil depois de uma reinstalação, por isso existe uma segunda cópia: o mapa das chaves raiz é selado **com uma chave derivada da frase semente** e colocado na sua ranhura do RecoveryShard. Um dispositivo novo que tenha apenas a semente encontra a ranhura, lê-a e decifra-a — e as conversas voltam.

Na ranhura guarda-se apenas aquilo que não pode ser derivado de novo.

## O que está protegido e o que se vê

Uma lista honesta — sem ela, qualquer promessa vale pouco.

**Protegido:**

- o conteúdo da correspondência privada: só você e a pessoa a quem escreve conseguem lê-lo;
- a quem se dirige uma mensagem privada: o destinatário fica oculto pelo endereçamento furtivo e pelo `bucket` opaco;
- o grafo de quem fala com quem: sem a chave raiz, os dois sentidos não podem ser ligados um ao outro.

**Visível para todos:**

- que uma carteira publicou uma cápsula privada, quando, e de que classe de tamanho;
- tudo o que é público — texto, imagens, comentários e a carteira do autor.

## Permanência na cadeia

| O quê | Quanto tempo |
|---|---|
| Primeiro contacto | 1 semana |
| Correspondência privada | 1 ano |
| Publicações e comentários públicos | 1 ano |

Terminado o prazo, a entrada é varrida do seu fragmento. A transação que a publicou permanece no histórico da cadeia por tempo indeterminado: apagar dados numa blockchain não é possível.

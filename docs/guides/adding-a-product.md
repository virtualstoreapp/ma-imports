# Como adicionar um produto

Você não precisa mexer em código. Tudo é feito pelo site do GitHub, do celular ou
do computador.

## Adicionar um produto novo

1. Abra [**Issues → New issue**](../../issues/new/choose) e escolha
   **Adicionar produto**.
2. Preencha o formulário:

   | Campo | O que colocar |
   |---|---|
   | **Categoria** | Onde o produto aparece no catálogo. A lista já vem pronta |
   | **Marca** | A marca do produto, ou **Sem marca** |
   | **Modelo** | A linha do produto, quando houver: `Shox`, `Campus`. Pode deixar em branco |
   | **Preço** | O preço de venda: `89,90` |
   | **Preço antigo** | Só se estiver com desconto. Precisa ser **maior** que o preço |
   | **Tamanhos** | Os tamanhos disponíveis, separados por vírgula: `P, M, G` |
   | **Observação de tamanho** | No lugar de Tamanhos, quando não é uma lista: `Tamanho único`, `Consultar` |
   | **Descrição** | O texto que aparece no cartão do produto |
   | **Fotos** | Arraste a foto, ou toque para escolher da galeria |

3. Clique em **Submit new issue**.
4. Em um ou dois minutos, um robô responde:
   - **deu tudo certo** — ele abre um *Pull Request* com a alteração. Revise a
     foto e os dados e clique em **Merge**. O site atualiza sozinho em poucos
     minutos.
   - **faltou algo** — ele comenta na issue dizendo exatamente o que corrigir.
     Edite a issue e ele tenta de novo.

### Sobre os tamanhos

Cada tamanho é **uma peça**. Se você escreve `P, M, G`, o catálogo entende que
existe uma peça de cada. Quando uma vende, só aquele tamanho sai de circulação —
o produto continua no ar com os outros.

Produtos sem tamanho, como bonés e carteiras, ficam com o campo **Tamanhos** em
branco.

### Sobre as fotos

- Pode enviar **uma ou duas**. Com duas, a primeira é a frente e a segunda o
  verso.
- A foto é convertida automaticamente. Não precisa redimensionar nem renomear.
- O nome do arquivo não importa: o sistema renomeia usando o código do produto.

## Marcar um tamanho como esgotado

Quando vender uma peça:

1. Abra **Actions → Edit product → Run workflow**.
2. Preencha:
   - **Código do produto** — os 10 dígitos que aparecem no nome, por exemplo
     `2307251157`
   - **Tamanhos esgotados** — os tamanhos que acabaram: `M`. Para liberar todos
     de novo, escreva `nenhum`
3. Clique em **Run workflow**. Um Pull Request é aberto; revise e faça o merge.

O mesmo formulário serve para mudar **preço**, **preço antigo** e **descrição**.
Deixe em branco o que não quer mudar.

> Os tamanhos esgotados são **substituídos**, não somados. Se `M` já estava
> esgotado e você escreve `G`, o resultado é: `M` disponível e `G` esgotado. Para
> ter os dois esgotados, escreva `M, G`.

## Por que passa por Pull Request

Nada vai para o site sem duas verificações:

1. **Automática** — o catálogo é validado inteiro: preço, foto, categoria, código
   único. Se algo estiver errado, o robô não abre o PR.
2. **Sua** — você vê a foto e os dados antes de aprovar.

É a mesma verificação que uma alteração feita por um desenvolvedor enfrenta.

## Quando algo não funciona

| O que aconteceu | O que fazer |
|---|---|
| O robô diz que você não tem permissão | Seu usuário precisa estar na variável `PRODUCT_AUTHORS` do repositório. Um desenvolvedor adiciona |
| O robô diz que a categoria não existe | Escolha uma da lista. Categorias novas são criadas por um desenvolvedor |
| O robô diz que a marca não existe | Escolha uma da lista, ou **Sem marca**. Marcas novas são adicionadas por um desenvolvedor |
| O robô reclama do preço | Use vírgula ou ponto e no máximo dois decimais: `89,90` |
| A foto não foi aceita | Envie de novo pelo campo **Fotos** da issue. Só fotos anexadas na própria issue são aceitas |

## Para desenvolvedores

- O formulário em `.github/ISSUE_TEMPLATE/add-product.yml` é **gerado** a partir
  de `catalog/categories.json` e `catalog/brands.json`. Não edite à mão: rode
  `node tools/sync-issue-form.js`. O build falha se estiver desatualizado.
- Nenhum campo tem `placeholder`. Com eles, o GitHub **não renderiza** o
  formulário: ele desaparece da lista de templates e `?template=` cai num issue
  em branco, sem erro nenhum. Os exemplos ficam no `description` de cada campo.
  Um teste garante isso — não reintroduza `placeholder` sem conferir a lista.
- Adicionar uma marca é uma linha em `catalog/brands.json` mais um
  `node tools/sync-issue-form.js`.
- A lógica está em `tools/lib/authoring.js` e `tools/authoring/`, com testes em
  `tests/tools/authoring.test.js`, `add-product.test.js` e `edit-product.test.js`.
  Os workflows só passam entradas e abrem o PR.
- A permissão vem da variável de repositório `PRODUCT_AUTHORS`, uma lista de
  usuários separada por vírgula.

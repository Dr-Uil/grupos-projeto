# Grupos de Projeto

Plataforma de organização de grupos de projeto por turma. Aplicação de arquivo
único (`index.html`), publicada no GitHub Pages, com Firebase Authentication e
Cloud Firestore.

**Acesso:** https://dr-uil.github.io/grupos-projeto/

## Como funciona

- **Professor** cria conta com e-mail e senha. A conta nasce *pendente* e só
  funciona depois que o administrador aprova. Cada professor enxerga e edita
  apenas as próprias turmas.
- **Administrador** (definido por e-mail em `firestore.rules` e em
  `ADMIN_EMAILS` no `index.html`) aprova ou remove professores no painel 🛡️.
- **Aluno** entra pelo link/QR Code da turma, informa nome e matrícula e escolhe
  um grupo. Não precisa criar conta — a sessão é anônima.

## Regras que o servidor garante (não dá para burlar pelo navegador)

- Ninguém se autoaprova: o cadastro só pode ser criado com `aprovado: false`.
- Um professor não lê nem escreve turmas de outro professor.
- O aluno só pode **acrescentar a si mesmo** a um grupo: não remove colegas, não
  edita notas, não altera nenhum outro campo.
- Uma matrícula só se inscreve uma vez por turma — a trava é o id do documento
  em `turmas/{id}/inscricoes/{matricula}`, que o Firestore recusa duplicar.
- O limite de vagas é conferido no servidor, então dois alunos simultâneos não
  ocupam a mesma última vaga.

## Estrutura dos dados

```
professores/{uid}                      { email, nome, aprovado, admin, criadoEm }
turmas/{turmaId}                       { nome, ownerUid, ownerEmail, inscricoesAbertas }
turmas/{turmaId}/grupos/{grupoId}      { nome, tema, limite, representante, alunos[], notas{} }
turmas/{turmaId}/inscricoes/{matricula}{ nome, matricula, grupoId, uid, criadoEm }
app/dados                              documento do formato antigo (somente leitura, para migração)
```

## Configuração no console (uma vez)

1. **Firebase → Authentication → Sign-in method:** ativar **E-mail/senha** e **Anônimo**.
2. **Authentication → Settings → Domínios autorizados:** incluir `dr-uil.github.io`.
3. **Firestore → Regras:** colar o conteúdo de [`firestore.rules`](firestore.rules) e publicar.
4. **Google Cloud → Credenciais → chave de API:** restringir por referenciador HTTP
   a `dr-uil.github.io/*` e `localhost`.

Para trocar ou acrescentar administradores, edite `adminEmails()` em
`firestore.rules` **e** `ADMIN_EMAILS` em `index.html` — as duas listas precisam
bater.

## Migração dos dados antigos

O formato anterior guardava tudo em um único documento (`app/dados`), com o nome
da turma como chave. Ao entrar como administrador, o painel 🛡️ mostra o botão
**"Importar dados antigos"**, que copia turmas, grupos, temas, representantes,
alunos e notas para o novo modelo. A importação é idempotente (marcada por
`legadoKey` em cada turma) e não apaga o documento antigo.

## Desenvolvimento

```bash
python3 -m http.server 8080   # http://localhost:8080
```

`localhost` já é domínio autorizado no Firebase Authentication por padrão.

import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import fs from "node:fs";

const ADMIN = "uomagalhaes@gmail.com";
let env;
let passed = 0, failed = 0;
const results = [];

async function t(nome, fn) {
  try { await fn(); passed++; results.push(`  ✓ ${nome}`); }
  catch (e) { failed++; results.push(`  ✗ ${nome}\n      ${String(e).split("\n")[0]}`); }
}

env = await initializeTestEnvironment({
  projectId: "grupos-projeto-test",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8571 },
});

// Contextos
const anon    = env.authenticatedContext("anon1", { provider_id: "anonymous" }).firestore();
const anon2   = env.authenticatedContext("anon2", { provider_id: "anonymous" }).firestore();
const semAuth = env.unauthenticatedContext().firestore();
const profA   = env.authenticatedContext("profA", { email: "a@escola.com", email_verified: true }).firestore();
const profB   = env.authenticatedContext("profB", { email: "b@escola.com", email_verified: true }).firestore();
const novato  = env.authenticatedContext("novo", { email: "novo@escola.com", email_verified: true }).firestore();
const admin   = env.authenticatedContext("adm",  { email: ADMIN, email_verified: true }).firestore();
const admNV   = env.authenticatedContext("adm2", { email: ADMIN, email_verified: false }).firestore();

// Estado inicial, escrito ignorando as regras.
await env.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, "professores/profA"), { email:"a@escola.com", nome:"A", aprovado:true,  admin:false });
  await setDoc(doc(d, "professores/profB"), { email:"b@escola.com", nome:"B", aprovado:true,  admin:false });
  await setDoc(doc(d, "professores/novo"),  { email:"novo@escola.com", nome:"N", aprovado:false, admin:false });
  await setDoc(doc(d, "professores/adm"),   { email:ADMIN, nome:"Admin", aprovado:true, admin:true });
  await setDoc(doc(d, "turmas/t1"), { nome:"Turma A", ownerUid:"profA", ownerEmail:"a@escola.com", inscricoesAbertas:true });
  await setDoc(doc(d, "turmas/t2"), { nome:"Turma Fechada", ownerUid:"profA", inscricoesAbertas:false });
  await setDoc(doc(d, "turmas/t1/grupos/g1"), { nome:"Grupo 1", tema:"", limite:2, representante:"", alunos:[], notas:{} });
  await setDoc(doc(d, "turmas/t1/grupos/g2"), { nome:"Grupo 2", tema:"", limite:0, representante:"",
    alunos:[{nome:"Ja Existe", matricula:"111", uid:""}], notas:{} });
  await setDoc(doc(d, "turmas/t2/grupos/g9"), { nome:"Grupo 9", limite:0, alunos:[], notas:{} });
  await setDoc(doc(d, "turmas/t1/inscricoes/999"), { nome:"Ocupada", matricula:"999", grupoId:"g1" });
  await setDoc(doc(d, "app/dados"), { turmas:{}, password:"legado" });
});

const aluno = (nome, mat) => ({ nome, matricula: mat, uid: "" });

console.log("\n=== CONTAS DE PROFESSOR ===");
await t("aluno anônimo NÃO lê a lista de professores", () =>
  assertFails(getDocs(collection(anon, "professores"))));
await t("professor NÃO lê a conta de outro professor", () =>
  assertFails(getDoc(doc(profB, "professores/profA"))));
await t("professor lê a própria conta", () =>
  assertSucceeds(getDoc(doc(profA, "professores/profA"))));
await t("admin lê todas as contas", () =>
  assertSucceeds(getDocs(collection(admin, "professores"))));
await t("cadastro NÃO pode nascer já aprovado", () =>
  assertFails(setDoc(doc(env.authenticatedContext("x1",{email:"x@e.com"}).firestore(), "professores/x1"),
    { email:"x@e.com", nome:"X", aprovado:true, admin:false })));
await t("cadastro NÃO pode nascer como admin", () =>
  assertFails(setDoc(doc(env.authenticatedContext("x2",{email:"x2@e.com"}).firestore(), "professores/x2"),
    { email:"x2@e.com", nome:"X", aprovado:false, admin:true })));
await t("cadastro pendente é aceito", () =>
  assertSucceeds(setDoc(doc(env.authenticatedContext("x3",{email:"x3@e.com"}).firestore(), "professores/x3"),
    { email:"x3@e.com", nome:"X", aprovado:false, admin:false })));
await t("professor NÃO cria conta com outro uid", () =>
  assertFails(setDoc(doc(env.authenticatedContext("x4",{email:"x4@e.com"}).firestore(), "professores/OUTRO"),
    { email:"x4@e.com", nome:"X", aprovado:false, admin:false })));
await t("professor NÃO se autoaprova", () =>
  assertFails(updateDoc(doc(novato, "professores/novo"), { aprovado:true })));
await t("professor edita só o próprio nome", () =>
  assertSucceeds(updateDoc(doc(profA, "professores/profA"), { nome:"A. Silva" })));
await t("admin aprova um professor", () =>
  assertSucceeds(updateDoc(doc(admin, "professores/novo"), { aprovado:true })));
await t("admin com e-mail NÃO confirmado não é admin", () =>
  assertFails(updateDoc(doc(admNV, "professores/profB"), { aprovado:false })));

console.log("=== TURMAS ===");
await t("professor não aprovado NÃO cria turma", () =>
  assertFails(setDoc(doc(env.authenticatedContext("x5",{email:"x5@e.com"}).firestore(), "turmas/nova"),
    { nome:"T", ownerUid:"x5" })));
await t("professor aprovado cria a própria turma", () =>
  assertSucceeds(setDoc(doc(profB, "turmas/tB"), { nome:"Turma B", ownerUid:"profB" })));
await t("professor NÃO cria turma em nome de outro", () =>
  assertFails(setDoc(doc(profB, "turmas/tX"), { nome:"T", ownerUid:"profA" })));
await t("professor NÃO edita a turma de outro", () =>
  assertFails(updateDoc(doc(profB, "turmas/t1"), { nome:"Sequestrada" })));
await t("professor NÃO apaga a turma de outro", () =>
  assertFails(deleteDoc(doc(profB, "turmas/t1"))));
await t("professor NÃO transfere a própria turma para outro dono", () =>
  assertFails(updateDoc(doc(profA, "turmas/t1"), { ownerUid:"profB" })));
await t("dono edita a própria turma", () =>
  assertSucceeds(updateDoc(doc(profA, "turmas/t1"), { inscricoesAbertas:true })));
await t("aluno lê a turma pelo link", () =>
  assertSucceeds(getDoc(doc(anon, "turmas/t1"))));

console.log("=== GRUPOS: O QUE O ALUNO PODE FAZER ===");
await t("aluno lê os grupos da turma", () =>
  assertSucceeds(getDocs(collection(anon, "turmas/t1/grupos"))));
await t("aluno se acrescenta ao grupo", () =>
  assertSucceeds(updateDoc(doc(anon, "turmas/t1/grupos/g2"),
    { alunos:[aluno("Ja Existe","111"), aluno("Novo Aluno","222")] })));
await t("aluno NÃO remove um colega", () =>
  assertFails(updateDoc(doc(anon2, "turmas/t1/grupos/g2"), { alunos:[] })));
await t("aluno NÃO substitui um colega por si mesmo", () =>
  assertFails(updateDoc(doc(anon2, "turmas/t1/grupos/g2"),
    { alunos:[aluno("Impostor","333"), aluno("Novo Aluno","222")] })));
await t("aluno NÃO entra duas vezes de uma só escrita", () =>
  assertFails(updateDoc(doc(anon2, "turmas/t1/grupos/g1"),
    { alunos:[aluno("A","1"), aluno("B","2")] })));
await t("aluno NÃO edita as notas do grupo", () =>
  assertFails(updateDoc(doc(anon2, "turmas/t1/grupos/g2"), { notas:{ entrega_final: 20 } })));
await t("aluno NÃO edita o tema junto com a inscrição", () =>
  assertFails(updateDoc(doc(anon2, "turmas/t1/grupos/g2"),
    { alunos:[aluno("Ja Existe","111"), aluno("Novo Aluno","222"), aluno("C","3")], tema:"hack" })));
await t("aluno NÃO se define representante", () =>
  assertFails(updateDoc(doc(anon2, "turmas/t1/grupos/g2"), { representante:"Novo Aluno" })));
await t("aluno NÃO cria grupo", () =>
  assertFails(setDoc(doc(anon2, "turmas/t1/grupos/gNovo"), { nome:"G", alunos:[] })));
await t("aluno NÃO apaga grupo", () =>
  assertFails(deleteDoc(doc(anon2, "turmas/t1/grupos/g1"))));
await t("aluno NÃO entra em turma com inscrições fechadas", () =>
  assertFails(updateDoc(doc(anon2, "turmas/t2/grupos/g9"), { alunos:[aluno("Tarde","444")] })));

console.log("=== LIMITE DE VAGAS (no servidor) ===");
await t("primeira vaga é aceita", () =>
  assertSucceeds(updateDoc(doc(anon, "turmas/t1/grupos/g1"), { alunos:[aluno("Um","A1")] })));
await t("última vaga é aceita", () =>
  assertSucceeds(updateDoc(doc(anon2, "turmas/t1/grupos/g1"), { alunos:[aluno("Um","A1"), aluno("Dois","A2")] })));
await t("estourar o limite é recusado", () =>
  assertFails(updateDoc(doc(anon2, "turmas/t1/grupos/g1"),
    { alunos:[aluno("Um","A1"), aluno("Dois","A2"), aluno("Tres","A3")] })));

console.log("=== TRAVA DE MATRÍCULA ===");
await t("inscrição nova é aceita", () =>
  assertSucceeds(setDoc(doc(anon, "turmas/t1/inscricoes/555"),
    { nome:"Fulano", matricula:"555", grupoId:"g2", uid:"anon1" })));
await t("matrícula repetida é recusada pelo servidor", () =>
  assertFails(setDoc(doc(anon2, "turmas/t1/inscricoes/999"),
    { nome:"Outro", matricula:"999", grupoId:"g2", uid:"anon2" })));
await t("aluno NÃO apaga a própria inscrição para trocar de grupo", () =>
  assertFails(deleteDoc(doc(anon, "turmas/t1/inscricoes/555"))));
await t("aluno NÃO lê as inscrições da turma", () =>
  assertFails(getDocs(collection(anon2, "turmas/t1/inscricoes"))));
await t("dono da turma lê as inscrições", () =>
  assertSucceeds(getDocs(collection(profA, "turmas/t1/inscricoes"))));
await t("dono da turma libera uma matrícula", () =>
  assertSucceeds(deleteDoc(doc(profA, "turmas/t1/inscricoes/555"))));

console.log("=== DOCUMENTO LEGADO E RESTO DO BANCO ===");
await t("ninguém escreve no documento antigo (app/dados)", () =>
  assertFails(setDoc(doc(anon2, "app/dados"), { turmas:{} })));
await t("nem o admin escreve no documento antigo", () =>
  assertFails(setDoc(doc(admin, "app/dados"), { turmas:{} })));
await t("aluno NÃO lê o documento antigo", () =>
  assertFails(getDoc(doc(anon2, "app/dados"))));
await t("admin lê o documento antigo (para migrar)", () =>
  assertSucceeds(getDoc(doc(admin, "app/dados"))));
await t("coleção desconhecida é inacessível", () =>
  assertFails(setDoc(doc(anon2, "qualquer/coisa"), { a:1 })));
await t("visitante sem login algum não escreve nada", () =>
  assertFails(updateDoc(doc(semAuth, "turmas/t1/grupos/g2"), { alunos:[aluno("X","9")] })));

console.log(results.join("\n"));
console.log(`\n${passed} passaram, ${failed} falharam\n`);
await env.cleanup();
process.exit(failed ? 1 : 0);

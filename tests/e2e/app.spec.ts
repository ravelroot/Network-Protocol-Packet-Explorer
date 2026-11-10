import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (erro) => {
    throw erro;
  });
});

test('mostra os 33 protocolos e as quatro abas com as contagens certas', async ({ page }) => {
  await page.goto('./#/http');
  const abas = page.locator('.aba');
  await expect(abas).toHaveCount(4);
  await expect(abas.nth(0)).toContainText('33');
  await expect(abas.nth(1)).toContainText('8');
  await expect(abas.nth(2)).toContainText('16');
  await expect(abas.nth(3)).toContainText('9');
  await expect(page.locator('.protocolo')).toHaveCount(33);
  await abas.nth(3).click();
  await expect(page.locator('.protocolo')).toHaveCount(9);
});

test('toca o DNS, avança por passos e abre o inspetor byte a byte', async ({ page }) => {
  await page.goto('./#/dns');
  await expect(page.locator('.painel-sigla')).toHaveText('DNS');
  await expect(page.locator('.tabela-pacotes tbody tr.vazio')).toBeVisible();
  await page.getByRole('button', { name: /^(Passo|Step)$/ }).click();
  await expect(page.locator('.tabela-pacotes tbody tr:not(.vazio)')).toHaveCount(1);
  await page.locator('.tabela-pacotes tbody tr').first().click();
  await expect(page.locator('.inspetor .byte')).toHaveCount(75);
  await expect(page.locator('.insp-segmento')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(page.locator('.inspetor .byte')).toHaveCount(0);
});

test('toca a animação e mostra os pacotes chegando', async ({ page }) => {
  await page.goto('./#/tcp');
  await page.keyboard.press('Space');
  await expect(page.locator('.tabela-pacotes tbody tr:not(.vazio)').first()).toBeVisible({ timeout: 5000 });
  await page.keyboard.press('Space');
  await page.keyboard.press('v');
  await expect(page.locator('.vista-sequencia')).toBeVisible();
});

test('busca abre com Ctrl+K e navega para o protocolo escolhido', async ({ page }) => {
  await page.goto('./#/http');
  await page.keyboard.press('Control+k');
  await page.locator('.busca-campo').fill('wireguard');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/wireguard$/);
  await expect(page.locator('.painel-sigla')).toHaveText('WireGuard');
});

test('troca idioma e tema e mantém a escolha', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./#/http');
  const titulo = page.locator('.lista .titulo-secao');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  await expect(titulo).toHaveText(/Protocolos da internet/i);
  await page.keyboard.press('l');
  await expect(titulo).toHaveText(/Internet protocols/i);
  await page.keyboard.press('t');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
  await expect(titulo).toHaveText(/Internet protocols/i);
});

test('segue o tema do sistema na primeira visita', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./#/http');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
});

test('troca a paleta pelo menu e pelo teclado e mantém a escolha', async ({ page }) => {
  await page.goto('./#/http');
  const raiz = page.locator('html');
  await expect(raiz).not.toHaveAttribute('data-paleta', /.+/);
  await page.locator('.cabecalho .paleta').click();
  await expect(page.locator('.menu .menu-item')).toHaveCount(4);
  await page.locator('.menu .menu-item', { hasText: 'Sonda' }).click();
  await expect(raiz).toHaveAttribute('data-paleta', 'sonda');
  await expect(page.locator('.menu')).toHaveCount(0);
  await page.locator('body').click({ position: { x: 700, y: 400 } });
  await page.keyboard.press('c');
  await expect(raiz).toHaveAttribute('data-paleta', 'nexo');
  await page.reload();
  await expect(raiz).toHaveAttribute('data-paleta', 'nexo');
  await expect(page.locator('.barra-status')).toContainText('Paleta Nexo');
});

test('mostra a marca e a barra de status', async ({ page }) => {
  await page.goto('./#/tcp');
  await expect(page.locator('.marca-nome')).toHaveText('Ocelo');
  await expect(page.locator('.marca-quadro svg')).toBeVisible();
  await expect(page.locator('.barra-status')).toContainText('TCP');
});

test('publica com política de segurança de conteúdo', async ({ page }) => {
  await page.goto('./');
  const politica = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(politica).toContain("script-src 'self'");
  expect(politica).toContain("object-src 'none'");
});

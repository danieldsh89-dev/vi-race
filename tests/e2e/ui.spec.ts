import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [360, 768, 1440])
  test(`pantallas accesibles y sin desbordamiento a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/",
      "/projects",
      "/radar",
      "/methodology",
      "/sources",
      "/status",
      "/compare",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(result.violations).toEqual([]);
    }
    if (width === 1440) {
      await page.goto("/");
      await page.screenshot({
        path: "test-results/dashboard-real-vacio.png",
        fullPage: true,
      });
    }
  });
test("demo, filtros conservados, ficha, pruebas y método", async ({ page }) => {
  await page.goto("/?demo=1");
  await expect(
    page.getByText("Demostración con datos ficticios.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Atlas Runtime/ })).toBeVisible();
  await page
    .getByRole("link", { name: "Proyectos", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Buscar proyectos" }).fill("Atlas");
  await expect(page).toHaveURL(/q=Atlas/);
  await expect(page.getByText("1 proyectos encontrados")).toBeVisible();
  await page.getByRole("link", { name: /Atlas Runtime/ }).click();
  await expect(
    page.getByRole("heading", { name: "Los 20 hitos" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Consultar evidencia E2" })
    .first()
    .click();
  await expect(page).toHaveURL(/#evidence_fixture/);
  // Política de enlaces: sin autorización expresa, las URL de material,
  // fuentes y proyecto se muestran como texto, nunca como hipervínculo.
  await expect(page.getByText("Material original:").first()).toBeVisible();
  await expect(page.locator('main a[href^="https://example.com"]')).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: /Proyectos \/ Atlas/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Buscar proyectos" }),
  ).toHaveValue("Atlas");
  await page.goto("/methodology?demo=1");
  await expect(
    page.getByRole("heading", { name: "20 hitos · 100 puntos" }),
  ).toBeVisible();
});
test("respaldo sin API y aviso sin conexión", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByText("La carrera empieza con pruebas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Comprobar datos publicados" }),
  ).toBeDisabled();
  await context.setOffline(true);
  await expect(
    page.getByText(
      "Sin conexión. Se conserva la información disponible y su fecha.",
    ),
  ).toBeVisible();
  await context.setOffline(false);
});
test("comparador no mezcla componentes y temas respetan contraste", async ({
  page,
}) => {
  await page.goto("/compare?demo=1");
  await page.getByRole("checkbox", { name: "Atlas Runtime" }).check();
  await expect(page).toHaveURL(/ids=project_fixture_atlas/);
  await page.getByRole("checkbox", { name: "Meridian Bridge" }).check();
  await expect(page).toHaveURL(/meridian/);
  await expect(page.getByRole("checkbox", { name: "Prism Trace" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Activar tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const result = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  expect(result.violations).toEqual([]);
  for (const path of [
    "/",
    "/projects",
    "/radar",
    "/methodology",
    "/sources",
    "/status",
  ]) {
    await page.goto(`${path}?demo=1`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await page.goto("/?demo=1");
  await page.screenshot({
    path: "test-results/dashboard-demo-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({
    path: "test-results/dashboard-demo-mobile.png",
    fullPage: true,
  });
});

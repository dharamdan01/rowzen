
import { expect, test } from "@playwright/test";
import { validateCsv } from "./helpers";

test.describe(
  "Keyboard and semantic accessibility smoke checks",
  () => {
    test(
      "form controls have accessible labels and can receive keyboard focus",
      async ({ page }) => {
        await validateCsv(page, [
          "departments.csv",
          "students.csv",
        ]);

        // Scope controls to the Issue Explorer.
        const explorer = page.getByRole("region", {
          name: "Issue explorer",
        });

        await expect(explorer).toBeVisible();

        // Match semantic roles and accessible names.
        const dataset = explorer.getByRole("combobox", {
          name: /^Dataset\b/i,
        });

        const severity = explorer.getByRole("combobox", {
          name: /^Severity\b/i,
        });

        const search = explorer.getByRole("searchbox", {
          name: /^Search issues\b/i,
        });

        await expect(dataset).toBeVisible();
        await expect(severity).toBeVisible();
        await expect(search).toBeVisible();

        // Verify keyboard focus.
        await search.focus();
        await expect(search).toBeFocused();

        // Verify the accessible empty state.
        await search.fill("this-issue-does-not-exist");

        await expect(
          explorer.getByText(
            "No issues match the selected filters.",
          ),
        ).toBeVisible();
      },
    );

    test(
      "analytics tables expose accessible scroll regions and headings",
      async ({ page }) => {
        await validateCsv(page, [
          "departments.csv",
          "students.csv",
        ]);

        const datasetRegion = page.getByRole("region", {
          name: "Dataset-level validation analytics",
        });

        const issueRegion = page.getByRole("region", {
          name: "Filtered validation issues",
        });

        await expect(datasetRegion).toBeVisible();
        await expect(issueRegion).toBeVisible();

        await datasetRegion.focus();
        await expect(datasetRegion).toBeFocused();

        await expect(
          page.getByRole("heading", {
            name: "Validation overview",
          }),
        ).toBeVisible();
      },
    );
  },
);
  
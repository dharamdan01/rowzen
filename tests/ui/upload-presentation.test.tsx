import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FilePicker from "../../src/components/upload/file-picker";
import { Input } from "../../src/components/ui/primitives";
import { CsvPreview, DatasetList, UploadFeedback } from "../../src/components/upload/upload-presentation";
import { parseCsvText } from "../../src/lib/csv/parser";

const { setDragging } = vi.hoisted(() => ({ setDragging: vi.fn() }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: () => [false, setDragging],
}));

const dataset = parseCsvText('id,note\n1,"alpha\nbeta"\n\n2,second\n3,third\n4,fourth\n5,fifth\n6,sixth', "records.csv");

describe("upload file picker contract", () => {
  it("preserves native selection props, chosen File objects, and same-file reselection", () => {
    const onChoose = vi.fn();
    const picker = FilePicker({ onChoose });
    const input = picker.props.children.find((child: { type: unknown }) => child.type === Input);
    const file = new File(["id\n1"], "records.csv");
    const target = { files: [file], value: "selected" };
    input.props.onChange({ target });
    expect(onChoose).toHaveBeenCalledWith([file]);
    expect(target.value).toBe("");
    expect(input.props).toMatchObject({ id: "csv-files", type: "file", accept: ".csv,text/csv", multiple: true, disabled: false, "aria-describedby": "csv-help" });
  });
  it("forwards drops through the same callback without filtering files", () => {
    const onChoose = vi.fn();
    const picker = FilePicker({ onChoose });
    const files = [new File(["id\n1"], "records.csv"), new File(["text"], "notes.txt")];
    const preventDefault = vi.fn();
    picker.props.onDrop({ preventDefault, dataTransfer: { files } });
    expect(onChoose).toHaveBeenCalledWith(files);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setDragging).toHaveBeenCalledWith(false);
  });
  it("preserves drag feedback handlers", () => {
    const picker = FilePicker({ onChoose: vi.fn() });
    const preventDefault = vi.fn();
    picker.props.onDragOver({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setDragging).toHaveBeenLastCalledWith(true);
    picker.props.onDragLeave();
    expect(setDragging).toHaveBeenLastCalledWith(false);
  });
  it("disables selection and ignores drops while busy", () => {
    const onChoose = vi.fn();
    const picker = FilePicker({ onChoose, disabled: true });
    picker.props.onDrop({ preventDefault: vi.fn(), dataTransfer: { files: [new File(["id\n1"], "a.csv")] } });
    expect(onChoose).not.toHaveBeenCalled();
    const markup = renderToStaticMarkup(picker);
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('for="csv-files"');
  });
});

describe("upload presentation", () => {
  it("shows a dataset list with local configuration links, never validation success claims", () => {
    const markup = renderToStaticMarkup(h(DatasetList, { datasets: [dataset] }));
    expect(markup).toContain('href="#dataset-records"');
    expect(markup).toContain("1 dataset parsed");
    expect(markup).toContain("6 rows");
    expect(markup).not.toContain("READY");
    expect(renderToStaticMarkup(h(DatasetList, { datasets: [] }))).toBe("");
  });
  it("previews only five original rows and preserves physical line numbers and multiline text", () => {
    const original = structuredClone(dataset);
    const markup = renderToStaticMarkup(h(CsvPreview, { dataset }));
    expect(markup.match(/scope="row"/g)).toHaveLength(5);
    expect(markup).toContain("alpha\nbeta");
    expect(markup).toContain(">5</th>");
    expect(markup).not.toContain("sixth");
    expect(markup).toContain('role="region" aria-label="Preview of records.csv" tabindex="0"');
    expect(dataset).toEqual(original);
  });
  it("escapes untrusted filenames, headers, cells, and errors", () => {
    const unsafe = parseCsvText("id,<unsafe>\n1,<script>alert(1)</script>", "<unsafe>.csv");
    const markup = renderToStaticMarkup(h("div", null,
      h(DatasetList, { datasets: [unsafe] }), h(CsvPreview, { dataset: unsafe }),
      h(UploadFeedback, { busy: false, error: "<script>invalid</script>" })));
    expect(markup).toContain("&lt;unsafe&gt;");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).toContain('href="#dataset-%253Cunsafe%253E"');
    expect(markup).not.toContain("<script>");
  });
  it("retains exact loading and error messages and their announcement roles", () => {
    const markup = renderToStaticMarkup(h(UploadFeedback, { busy: true, error: "records.csv: duplicate column headers" }));
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Reading CSV files...");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("records.csv: duplicate column headers");
    expect(renderToStaticMarkup(h(UploadFeedback, { busy: false, error: "" }))).toBe("");
  });
});


it("only promises retained data when an unsuccessful replacement has a previous selection", () => {
  const replacement = renderToStaticMarkup(h(UploadFeedback, {busy: false, error: "Invalid CSV", hasCurrentData: true}));
  expect(replacement).toContain("Your previous selection, settings and corrections are still available");
  const initial = renderToStaticMarkup(h(UploadFeedback, {busy: false, error: "Invalid CSV"}));
  expect(initial).not.toContain("Your previous selection");
});

async function test() {
  const spreadsheetId = '1a4fKQhjvqwg486PXTO7VRPU65IPaUW_gEARl9Ky7USA';
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Orders`;
  const res = await globalThis.fetch(url);
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("CSV:", text.substring(0, 300));
}
test();

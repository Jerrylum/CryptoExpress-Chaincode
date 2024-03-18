
export function getMetadataJson(): any {
  const rootPath = process.cwd();
  const metadata = require(`${rootPath}/contract-metadata/template.json`);

  return JSON.parse(JSON.stringify(metadata)); // deep copy
}

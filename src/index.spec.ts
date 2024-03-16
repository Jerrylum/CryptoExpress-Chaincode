
export function getMetadataJson(): any {
  const rootPath = process.cwd();
  const metadata = require(`${rootPath}/contract-metadata/metadata.json`);

  return JSON.parse(JSON.stringify(metadata)); // deep copy
}

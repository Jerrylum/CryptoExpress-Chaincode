
export function getMetadataJson(): any {
  const rootPath = process.cwd();
  const metadata = require(`${rootPath}/META-INF/metadata.json`);

  return JSON.parse(JSON.stringify(metadata)); // deep copy
}

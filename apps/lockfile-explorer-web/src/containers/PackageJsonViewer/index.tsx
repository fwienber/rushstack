import React, { useCallback, useEffect, useState } from 'react';
import { readCJS, readParsedCJS, readPackageJSON } from '../../parsing/readCJS';
import styles from './styles.scss';

enum PackageView {
  PACKAGE_JSON,
  CJS,
  PARSED_PACKAGE_JSON
}

export const PackageJsonViewer = (): JSX.Element => {
  const [packageJSON, setPackageJSON] = useState('');
  const [parsedPackageJSON, setParsedPackageJSON] = useState('');
  const [cjs, setCjs] = useState('');

  const [selection, setSelection] = useState<PackageView>(PackageView.PACKAGE_JSON);

  const cb = useCallback((s: PackageView) => () => setSelection(s), []);

  useEffect(() => {
    async function loadPackageDetails(): Promise<void> {
      const cjsFile = await readCJS();
      setCjs(cjsFile);
      const packageJSONFile = await readPackageJSON();
      setPackageJSON(packageJSONFile as string);
      const parsedJSON = await readParsedCJS();
      setParsedPackageJSON(parsedJSON as string);
    }
    /* eslint @typescript-eslint/no-floating-promises: off */
    loadPackageDetails();
  }, []);

  const renderFile = (): JSX.Element | null => {
    switch (selection) {
      case PackageView.PACKAGE_JSON:
        return <pre>{packageJSON}</pre>;
      case PackageView.CJS:
        return <pre>{cjs}</pre>;
      case PackageView.PARSED_PACKAGE_JSON:
        return <pre>{parsedPackageJSON}</pre>;
      default:
        return null;
    }
  };

  return (
    <div className={styles.PackageJsonViewerWrapper}>
      <button onClick={cb(PackageView.PACKAGE_JSON)}>package.json</button>
      <button onClick={cb(PackageView.CJS)}>.pnpmfile.cjs</button>
      <button onClick={cb(PackageView.PARSED_PACKAGE_JSON)}>Parsed package.json</button>

      <div className={styles.fileContents}>{renderFile()}</div>
    </div>
  );
};

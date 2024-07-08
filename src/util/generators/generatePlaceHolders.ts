export function generatePlaceHolders(numberOfPlaceHolders: number): string {
  let placeHolderString: string = '';

  for (let i = 0; i < numberOfPlaceHolders; i++) {
    if (i + 1 === numberOfPlaceHolders) {
      placeHolderString += '?';
      continue;
    };

    placeHolderString += '?, ';
  };

  return placeHolderString;
};
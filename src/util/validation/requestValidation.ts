interface RequestData {
  [key: string]: any,
};

export function undefinedValuesDetected(requestData: RequestData, expectedKeys: string[]): boolean {
  if (Object.keys(requestData).length !== expectedKeys.length) {
    return true;
  };

  for (const key of expectedKeys) {
    if (requestData[key] === undefined) {
      return true;
    };
  };

  return false;
};
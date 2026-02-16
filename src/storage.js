import { JSONBIN_API_KEY, JSONBIN_BIN_ID } from './config';

export async function storageGet(key) {
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Access-Key': JSONBIN_API_KEY
      }
    });

    if (!response.ok) {
      console.error('Failed to load from JSONBin:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('Loaded from JSONBin:', result.record);
    return { key, value: JSON.stringify(result.record) };
  } catch (err) {
    console.error('Error loading fixtures:', err);
    return null;
  }
}

export async function storageSet(key, value) {
  try {
    const data = JSON.parse(value);
    console.log('Saving to JSONBin:', data);

    const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': JSONBIN_API_KEY
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error('Failed to save to JSONBin:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('Saved to JSONBin successfully:', result);
    return { key, value };
  } catch (err) {
    console.error('Error saving fixtures:', err);
    return null;
  }
}

export async function storageDelete(key) {
  return { key, deleted: true };
}

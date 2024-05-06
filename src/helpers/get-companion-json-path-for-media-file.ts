import { existsSync } from "fs"
import { basename, dirname, extname, resolve } from 'path'
import { CONFIG } from '../config'

export function getCompanionJsonPathForMediaFile(mediaFilePath: string): string|null {
  const directoryPath = dirname(mediaFilePath);
  const mediaFileExtension = extname(mediaFilePath);
  let mediaFileNameWithoutExtension = basename(mediaFilePath, mediaFileExtension);

  // Sometimes (if the photo has been edited inside Google Photos) we get files with a `-edited` suffix
  // These images don't have their own .json sidecars - for these we'd want to use the JSON sidecar for the original image
  // so we can ignore the "-edited" suffix if there is one
  const suffixRegex = new RegExp(`-(${CONFIG.localizedEditedSuffixes.join('|')})$`);
  mediaFileNameWithoutExtension = mediaFileNameWithoutExtension.replace(suffixRegex, '');

  // The naming pattern for the JSON sidecar files provided by Google Takeout seem to be inconsistent. For `foo.jpg`,
  // the JSON file is sometimes `foo.json` but sometimes it's `foo.jpg.json`. Here we start building up a list of potential
  // JSON filenames so that we can try to find them later
  const potentialJsonFileNames: string[] = [
    `${mediaFileNameWithoutExtension}.json`,
    `${mediaFileNameWithoutExtension}${mediaFileExtension}.json`,
    `${mediaFileNameWithoutExtension}.jpg.json`,   // For videos that accompanied a motion photo
    `${mediaFileNameWithoutExtension}.HEIC.json`,   // For videos that accompanied a motion photo
  ];

  // Another edge case which seems to be quite inconsistent occurs when we have media files containing a number suffix for example "foo(1).jpg"
  // In this case, we don't get "foo(1).json" nor "foo(1).jpg.json". Instead, we strangely get "foo.jpg(1).json".
  // We can use a regex to look for this edge case and add that to the potential JSON filenames to look out for
  const nameWithCounterMatch = mediaFileNameWithoutExtension.match(/(?<name>.*)(?<counter>\(\d+\))$/);
  if (nameWithCounterMatch) {
    // We may have some edited files here too
    const name = nameWithCounterMatch?.groups?.['name'].replace(/[-]edited$/i, '');
    const counter = nameWithCounterMatch?.groups?.['counter'];
    potentialJsonFileNames.push(`${name}${mediaFileExtension}${counter}.json`);
    if (mediaFileExtension === '.MP4' || mediaFileExtension === '.mp4') {
      potentialJsonFileNames.push(`${name}.JPG${counter}.json`);
      potentialJsonFileNames.push(`${name}.jpg${counter}.json`);
      potentialJsonFileNames.push(`${name}.jpeg${counter}.json`);
      potentialJsonFileNames.push(`${name}.heic${counter}.json`);
    }
    // A reasonable approximation may also be to remove the counter
    //potentialJsonFileNames.push(`${name}${mediaFileExtension}.json`);
  }

  // Sometimes the media filename ends with extra dash (eg. filename_n-.jpg + filename_n.json)
  const endsWithExtraDash = mediaFileNameWithoutExtension.endsWith('_n-');

  // Sometimes the media filename ends with extra `n` char (eg. filename_n.jpg + filename_.json)
  const endsWithExtraNChar = mediaFileNameWithoutExtension.endsWith('_n');

  // And sometimes the media filename has extra underscore in it (e.g. filename_.jpg + filename.json)
  const endsWithExtraUnderscore = mediaFileNameWithoutExtension.endsWith('_');

  if (endsWithExtraDash || endsWithExtraNChar || endsWithExtraUnderscore) {
    // We need to remove that extra char at the end
    potentialJsonFileNames.push(`${mediaFileNameWithoutExtension.slice(0, -1)}.json`);
  }

  // Edge case where google/iOS creates a thumbnail as a JPG for an MP4 and saves it in a json sidecar possible for iOS Live Photos
  if (mediaFileExtension === '.MP4' || mediaFileExtension === '.mp4') {
    potentialJsonFileNames.push(`${mediaFileNameWithoutExtension}.JPG.json`);
    potentialJsonFileNames.push(`${mediaFileNameWithoutExtension}.jpg.json`);
    potentialJsonFileNames.push(`${mediaFileNameWithoutExtension}.jpeg.json`);
    potentialJsonFileNames.push(`${mediaFileNameWithoutExtension}.heic.json`);
  }

  // It seems like the length of json file names is capped at 47
  if (mediaFileNameWithoutExtension.length > 46) {
    potentialJsonFileNames.push(`${mediaFileNameWithoutExtension.slice(0,46)}.json`)
  }

  // Bizarre rules with the lowest priority. There isn't a good way to detect these since they ar additions to the 
  // companion file so we will just always add them at the end.
  potentialJsonFileNames.push(`${mediaFileNameWithoutExtension}.j.json`)
  potentialJsonFileNames.push(`${mediaFileNameWithoutExtension}.jp.json`)

  // Now look to see if we have a JSON file in the same directory as the image for any of the potential JSON file names
  // that we identified earlier
  for (const potentialJsonFileName of potentialJsonFileNames) {
    const jsonFilePath = resolve(directoryPath, potentialJsonFileName);
    if (existsSync(jsonFilePath)) {
      return jsonFilePath;
    }
  }

  // If no JSON file was found, just return null - we won't be able to adjust the date timestamps without finding a
  // suitable JSON sidecar file
  return null;
}

import { getSupabaseClient } from './supabaseClient';
import type { FieldPhotoGeo } from './fieldPhotos';

export function capturePosition(timeout=7000):Promise<FieldPhotoGeo|undefined>{
  if(typeof navigator==='undefined'||!navigator.geolocation) return Promise.resolve(undefined);
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(
    p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:new Date(p.timestamp).toISOString()}),
    ()=>resolve(undefined),{enableHighAccuracy:true,timeout,maximumAge:30_000}
  ));
}
export function gpsLabel(geo?:FieldPhotoGeo):string { return geo?.address || (geo ? `${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}` : 'Localização GPS não registrada'); }
export async function reverseGeocode(geo:FieldPhotoGeo):Promise<FieldPhotoGeo>{
  if(geo.address) return geo;
  try{const s=getSupabaseClient() as any;const {data,error}=await s.functions.invoke('reverse-geocode',{body:{latitude:geo.latitude,longitude:geo.longitude}});if(error||!data?.address)return geo;return {...geo,address:String(data.address)};}catch{return geo;}
}

export type ShareMode='native'|'download';
export async function shareEvidence(blob:Blob,fileName:string,navigatorLike:Pick<Navigator,'share'|'canShare'>|undefined=typeof navigator!=='undefined'?navigator:undefined):Promise<ShareMode>{
  const file=new File([blob],fileName,{type:blob.type||'image/jpeg'});
  if(navigatorLike?.share&&(!navigatorLike.canShare||navigatorLike.canShare({files:[file]}))){await navigatorLike.share({title:'Evidência Fireowl',files:[file]});return'native';}
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return'download';
}

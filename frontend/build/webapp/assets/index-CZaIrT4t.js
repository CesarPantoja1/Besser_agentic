import{bp as $}from"./index-CpZJC5q9.js";function E(b,L){for(var i=0;i<L.length;i++){const c=L[i];if(typeof c!="string"&&!Array.isArray(c)){for(const n in c)if(n!=="default"&&!(n in b)){const v=Object.getOwnPropertyDescriptor(c,n);v&&Object.defineProperty(b,n,v.get?v:{enumerable:!0,get:()=>c[n]})}}}return Object.freeze(Object.defineProperty(b,Symbol.toStringTag,{value:"Module"}))}var w={exports:{}};var F=w.exports,A;function G(){return A||(A=1,(function(b,L){(function(i,c){b.exports=c()})(typeof globalThis<"u"?globalThis:typeof window<"u"?window:F,(()=>(()=>{var i={d:(o,t)=>{for(var l in t)i.o(t,l)&&!i.o(o,l)&&Object.defineProperty(o,l,{enumerable:!0,get:t[l]})},o:(o,t)=>Object.prototype.hasOwnProperty.call(o,t),r:o=>{typeof Symbol<"u"&&Symbol.toStringTag&&Object.defineProperty(o,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(o,"__esModule",{value:!0})}},c={};i.r(c),i.d(c,{default:()=>T});var n=function(){return n=Object.assign||function(o){for(var t,l=1,e=arguments.length;l<e;l++)for(var a in t=arguments[l])Object.prototype.hasOwnProperty.call(t,a)&&(o[a]=t[a]);return o},n.apply(this,arguments)},v=function(){return v=Object.assign||function(o){for(var t,l=1,e=arguments.length;l<e;l++)for(var a in t=arguments[l])Object.prototype.hasOwnProperty.call(t,a)&&(o[a]=t[a]);return o},v.apply(this,arguments)};const T=function(o,t){t===void 0&&(t={}),(function(l,e){var a=l.BlockManager,_=e.category,D=e.blocks,u=e.stylePrefix,m=e.flexGrid,j=e.rowHeight,y=e.addBasicStyle,g="".concat(u,"row"),h="".concat(u,"cell"),x=m?`
    .`.concat(g,` {
      display: flex;
      justify-content: flex-start;
      align-items: stretch;
      flex-wrap: nowrap;
      padding: 10px;
    }
    @media (max-width: 768px) {
      .`).concat(g,` {
        flex-wrap: wrap;
      }
    }`):`
    .`.concat(g,` {
      display: table;
      padding: 10px;
      width: 100%;
    }
    @media (max-width: 768px) {
      .`).concat(u,"cell, .").concat(u,"cell30, .").concat(u,`cell70 {
        width: 100%;
        display: block;
      }
    }`),C=m?`
    .`.concat(h,` {
      min-height: `).concat(j,`px;
      flex-grow: 1;
      flex-basis: 100%;
    }`):`
    .`.concat(h,` {
      width: 8%;
      display: table-cell;
      height: `).concat(j,`px;
    }`),I=`
  .`.concat(u,`cell30 {
    width: 30%;
  }`),q=`
  .`.concat(u,`cell70 {
    width: 70%;
  }`),Z=1,O={tl:0,tc:0,tr:0,cl:0,cr:0,bl:0,br:0,minDim:Z},k=n(n({},O),{cr:1,bc:0,currentUnit:1,minDim:Z,step:.2});m&&(k.keyWidth="flex-basis");var z={class:g,"data-gjs-droppable":".".concat(h),"data-gjs-resizable":O,"data-gjs-name":"Row"},H={class:h,"data-gjs-draggable":".".concat(g),"data-gjs-resizable":k,"data-gjs-name":"Cell"};m&&(H["data-gjs-unstylable"]=["width"],H["data-gjs-stylable-require"]=["flex-basis"]);var N=[".".concat(g),".".concat(h)];l.on("selector:add",(function(p){return N.indexOf(p.getFullName())>=0&&p.set("private",1)}));var B=function(p){var M=[];for(var P in p){var f=p[P];f=f instanceof Array||f instanceof Object?JSON.stringify(f):f,M.push("".concat(P,"=").concat("'".concat(f,"'")))}return M.length?" ".concat(M.join(" ")):""},r=function(p){return D.indexOf(p)>=0},V=B(z),s=B(H),d={category:_,select:!0};r("column1")&&a.add("column1",n(n({},d),{label:e.labelColumn1,media:`<svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M2 20h20V4H2v16Zm-1 0V4a1 1 0 0 1 1-1h20a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1Z"/>
      </svg>`,content:"<div ".concat(V,`>
        <div `).concat(s,`></div>
      </div>
      `).concat(y?`<style>
          `.concat(x,`
          `).concat(C,`
        </style>`):"")})),r("column2")&&a.add("column2",n(n({},d),{label:e.labelColumn2,media:`<svg viewBox="0 0 23 24">
        <path fill="currentColor" d="M2 20h8V4H2v16Zm-1 0V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1ZM13 20h8V4h-8v16Zm-1 0V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1Z"/>
      </svg>`,content:"<div ".concat(V,`>
        <div `).concat(s,`></div>
        <div `).concat(s,`></div>
      </div>
      `).concat(y?`<style>
          `.concat(x,`
          `).concat(C,`
        </style>`):"")})),r("column3")&&a.add("column3",n(n({},d),{label:e.labelColumn3,media:`<svg viewBox="0 0 23 24">
        <path fill="currentColor" d="M2 20h4V4H2v16Zm-1 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1ZM17 20h4V4h-4v16Zm-1 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1ZM9.5 20h4V4h-4v16Zm-1 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z"/>
      </svg>`,content:"<div ".concat(V,`>
        <div `).concat(s,`></div>
        <div `).concat(s,`></div>
        <div `).concat(s,`></div>
      </div>
      `).concat(y?`<style>
          `.concat(x,`
          `).concat(C,`
        </style>`):"")})),r("column3-7")&&a.add("column3-7",n(n({},d),{label:e.labelColumn37,media:`<svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M2 20h5V4H2v16Zm-1 0V4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1ZM10 20h12V4H10v16Zm-1 0V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1Z"/>
      </svg>`,content:"<div ".concat(V,`>
        <div `).concat(s," style='").concat(m?"flex-basis":"width",`: 30%;'></div>
        <div `).concat(s," style='").concat(m?"flex-basis":"width",`: 70%;'></div>
      </div>
      `).concat(y?`<style>
          `.concat(x,`
          `).concat(C,`
          `).concat(I,`
          `).concat(q,`
        </style>`):"")})),r("text")&&a.add("text",n(n({},d),{activate:!0,label:e.labelText,media:`<svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M18.5,4L19.66,8.35L18.7,8.61C18.25,7.74 17.79,6.87 17.26,6.43C16.73,6 16.11,6 15.5,6H13V16.5C13,17 13,17.5 13.33,17.75C13.67,18 14.33,18 15,18V19H9V18C9.67,18 10.33,18 10.67,17.75C11,17.5 11,17 11,16.5V6H8.5C7.89,6 7.27,6 6.74,6.43C6.21,6.87 5.75,7.74 5.3,8.61L4.34,8.35L5.5,4H18.5Z" />
      </svg>`,content:{type:"text",content:"Insert your text here",style:{padding:"10px"}}})),r("link")&&a.add("link",n(n({},d),{label:e.labelLink,media:`<svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M3.9,12C3.9,10.29 5.29,8.9 7,8.9H11V7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H11V15.1H7C5.29,15.1 3.9,13.71 3.9,12M8,13H16V11H8V13M17,7H13V8.9H17C18.71,8.9 20.1,10.29 20.1,12C20.1,13.71 18.71,15.1 17,15.1H13V17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7Z" />
      </svg>`,content:{type:"link",content:"Link",style:{color:"#d983a6"}}})),r("image")&&a.add("image",n(n({},d),{activate:!0,label:e.labelImage,media:`<svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M21,3H3C2,3 1,4 1,5V19A2,2 0 0,0 3,21H21C22,21 23,20 23,19V5C23,4 22,3 21,3M5,17L8.5,12.5L11,15.5L14.5,11L19,17H5Z" />
      </svg>`,content:{style:{color:"black"},type:"image"}})),r("video")&&a.add("video",n(n({},d),{label:e.labelVideo,media:`<svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M10,15L15.19,12L10,9V15M21.56,7.17C21.69,7.64 21.78,8.27 21.84,9.07C21.91,9.87 21.94,10.56 21.94,11.16L22,12C22,14.19 21.84,15.8 21.56,16.83C21.31,17.73 20.73,18.31 19.83,18.56C19.36,18.69 18.5,18.78 17.18,18.84C15.88,18.91 14.69,18.94 13.59,18.94L12,19C7.81,19 5.2,18.84 4.17,18.56C3.27,18.31 2.69,17.73 2.44,16.83C2.31,16.36 2.22,15.73 2.16,14.93C2.09,14.13 2.06,13.44 2.06,12.84L2,12C2,9.81 2.16,8.2 2.44,7.17C2.69,6.27 3.27,5.69 4.17,5.44C4.64,5.31 5.5,5.22 6.82,5.16C8.12,5.09 9.31,5.06 10.41,5.06L12,5C16.19,5 18.8,5.16 19.83,5.44C20.73,5.69 21.31,6.27 21.56,7.17Z" />
      </svg>`,content:{type:"video",src:"img/video2.webm",style:{height:"350px",width:"615px"}}})),r("map")&&a.add("map",n(n({},d),{label:e.labelMap,media:`<svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M20.5,3L20.34,3.03L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21L3.66,20.97L9,18.9L15,21L20.64,19.1C20.85,19.03 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3M10,5.47L14,6.87V18.53L10,17.13V5.47M5,6.46L8,5.45V17.15L5,18.31V6.46M19,17.54L16,18.55V6.86L19,5.7V17.54Z" />
      </svg>`,content:{type:"map",style:{height:"350px"}}}))})(o,v({blocks:["column1","column2","column3","column3-7","text","link","image","video","map"],flexGrid:!1,stylePrefix:"gjs-",addBasicStyle:!0,category:"Basic",labelColumn1:"1 Column",labelColumn2:"2 Columns",labelColumn3:"3 Columns",labelColumn37:"2 Columns 3/7",labelText:"Text",labelLink:"Link",labelImage:"Image",labelVideo:"Video",labelMap:"Map",rowHeight:75},t))};return c})()))})(w)),w.exports}var S=G();const R=$(S),U=E({__proto__:null,default:R},[S]);export{U as i};

/* game.js: игровой режим страницы практической работы.

   Работает, только когда выбран профиль «Игровой» (html[data-profile="game"]).
   Под каждым блоком проверки появляется сцена в духе 16-битных платформеров.
   Персонажи, предметы и уровни оригинальные.

   Идея: страница это один уровень, каждая задача его участок.
   - Участки идут подряд: фон и земля продолжаются с того места, где кончился
     предыдущий участок, герой входит слева, куда ушел в прошлой сцене.
   - Идет проверка: герой бежит на месте.
   - Решение верное: герой перепрыгивает препятствие, берет «нуклеотид»
     и уходит вправо к следующей задаче; на итоговой задаче открывается портал.
   - Решение неверное: герой спотыкается о препятствие (враг, стена или яма)
     и возвращается к началу участка. Опыт не отнимается, серия решений
     с первой попытки начинается заново: игра подбадривает, а не наказывает.
   - Механика практики: опыт за упражнения по варианту (базовый 5, средний 8,
     продвинутый 12; VARIANT_XP), уровень героя со званием, серия, значки за пройденный
     уровень, всплывающие сообщения, HUD в верхней панели (звезды считаются
     по выбранному уровню студента).
   Состояние (сердца, пройденные участки) хранится в localStorage.
   Слушает события checker:start и checker:result из checker.js. */

/* >>> dungeon-art (версия 120): графика темы «Подземелье», источник assets/dungeon_art.js; правится там и копируется сюда */
/* Подземелье словарей: изометрические залы, герои, монстры, сундуки и лут (тема игрового режима practice 6).
   DungeonArt.world(canvas, этаж "f1".."f5", время) рисует зал; DungeonArt.sprite(имя) возвращает {canvas,w,h,type}. */

// All art is drawn on one pixel grid. The scene, portraits and inventory share these sprites.
const DungeonArt = (() => {
  const W = 456, H = 240, INK = "#1a1921";
  const BASE = {x: INK, d: "#49373b", s: "#7e564b", c: "#b7734f", l: "#e2af71", h: "#ffdba2",
    f: "#e2a178", F: "#f7c098", b: "#653d32", u: "#a68360", a: "#78858f", A: "#afbdc0", w: "#eee0bd", g: "#bd8e50", G: "#f6cd7d", e: "#382c39"};
  const suits = {
    hood: {d:"#513443",s:"#874852",c:"#ae5c54",l:"#d98664",h:"#ffbd84"},
    knight: {d:"#3c4753",s:"#626c78",c:"#909ea5",l:"#b9c5bf",h:"#e9e4c9"},
    mage: {d:"#48334e",s:"#695174",c:"#8a678f",l:"#b390ab",h:"#dfb9c5"},
    herbalist: {d:"#364d48",s:"#58705a",c:"#81a467",l:"#b4c58b",h:"#d3e2a3"},
    ranger: {d:"#344347",s:"#45695e",c:"#679480",l:"#97baa0",h:"#badcca"},
    sporeMage: {d:"#4d3755",s:"#73547f",c:"#a476aa",l:"#cf9fc6",h:"#ebc6d7"},
    smith: {d:"#524045",s:"#856052",c:"#ad7555",l:"#d89c6d",h:"#f5c68d"},
    mechanic: {d:"#34465c",s:"#51647b",c:"#708ca3",l:"#a8bcca",h:"#d1dee1"},
    starMage: {d:"#433c61",s:"#635987",c:"#8a79b5",l:"#b6a4db",h:"#e1d4ef"}
  };

  function rect(ctx,x,y,w,h,color) {
    ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
  }
  function line(ctx,x1,y1,x2,y2,color) {
    let x=Math.round(x1), y=Math.round(y1);
    const tx=Math.round(x2), ty=Math.round(y2), dx=Math.abs(tx-x), dy=-Math.abs(ty-y);
    const sx=x<tx?1:-1, sy=y<ty?1:-1; let err=dx+dy;
    ctx.fillStyle=color;
    for (;;) {
      ctx.fillRect(x,y,1,1);
      if(x===tx && y===ty) break;
      const d=2*err;
      if(d>=dy){err+=dy; x+=sx;}
      if(d<=dx){err+=dx; y+=sy;}
    }
  }
  function poly(ctx,points,color) {
    const pts=points.map(([x,y])=>[Math.round(x),Math.round(y)]);
    const ys=pts.map(p=>p[1]), top=Math.min(...ys), bottom=Math.max(...ys);
    ctx.fillStyle=color;
    for(let y=top;y<bottom;y++){
      const cuts=[];
      for(let i=0;i<pts.length;i++){
        const [x1,y1]=pts[i], [x2,y2]=pts[(i+1)%pts.length];
        if((y1<=y+0.5 && y2>y+0.5) || (y2<=y+0.5 && y1>y+0.5))
          cuts.push(x1+(y+0.5-y1)*(x2-x1)/(y2-y1));
      }
      cuts.sort((a,b)=>a-b);
      for(let i=0;i+1<cuts.length;i+=2){
        const a=Math.round(cuts[i]), b=Math.round(cuts[i+1]); ctx.fillRect(a,y,b-a,1);
      }
    }
  }
  const colorCache = new Map();
  function rgb(hex) {
    if(!colorCache.has(hex)) colorCache.set(hex,[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)));
    return colorCache.get(hex);
  }
  function mix(a,b,t) {
    t=Math.max(0,Math.min(1,t)); const x=rgb(a),y=rgb(b);
    return "#"+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,"0")).join("");
  }
  function noise(a,b=1,seed=1) {
    let n=Math.imul(a+7919,374761393)^Math.imul(b+seed*13,668265263);
    n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967296;
  }
  function glow(c,x,y,r,color,strength=.3){
    const [red,green,blue]=rgb(color), g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba('+[red,green,blue,strength].join(',')+')');
    g.addColorStop(1,'rgba('+[red,green,blue,0].join(',')+')'); c.fillStyle=g; c.fillRect(x-r,y-r,2*r,2*r);
  }
  function star(c,x,y,col,r=2){
    rect(c,x-r,y,2*r+1,1,col); rect(c,x,y-r,1,2*r+1,col);
    if(r>2) rect(c,x-1,y-1,3,3,col);
  }
  function oval(c,x,y,rx,ry,col){
    for(let dy=-ry;dy<=ry;dy++){
      const w=Math.round(rx*Math.sqrt(1-dy*dy/((ry+.2)*(ry+.2))));
      rect(c,x-w,y+dy,w*2+1,1,col);
    }
  }
  function sprite(c,rows,x,y,palette,outline=true) {
    const ox=Math.round(x), oy=Math.round(y);
    if(outline) rows.forEach((row,j)=>[...row].forEach((ch,i)=>{
      if(ch!=='.' && ch!==' '){ rect(c,ox+i-1,oy+j,3,1,INK); rect(c,ox+i,oy+j-1,1,3,INK); }
    }));
    rows.forEach((row,j)=>[...row].forEach((ch,i)=>{
      if(palette[ch]) rect(c,ox+i,oy+j,1,1,palette[ch]);
    }));
  }

  const bodies = {
    hood: [
      "......sscc.....","....ssclllcc...","...sscclhhlcc..","..dssclcllllcc.","..ssccbbuuuuc..","..sccbufFFFFb..","..sscbfFFxFF...","...sssfFFxFf...","...dsscffff....","..sslllsccd....","..sccllcccF....",".dsccsccdgff...",".ssccsbbggb....",".dscccdsssc....","dssccsduusc....","dsscsdduusc....",".dddbb..bb.....","...bbb..bbb...."],
    knight: [
      ".....cccll.....","...scccld......","..sscd..ss.....",".....scllcs....","....sclhhlcs...","...sccllllccs..","...dlccccccdd..","...scxxxAxAAd..","...dssddxdxx...","....scclccs....","...lddggddll...","..lccclcccssF..","..scccccccsff..","...sbbgGbbs....","...dsscccs.....","...dsccscs.....","....bb..bb.....","...bbd..dbb...."],
    mage: [
      "........cc.....",".......clc.....","......cllc.....",".....cllcc.....","....ccllccc....","...sscccllc....","..lllhhlllllc..","....duuffFFb...","....bffFFxF....",".....fuFFxF....","....scsgGss....","...sscllccsf...",".sssccllccsF...",".dscclgGcsc....","..dscllccss....","..sscllccss....",".dsccccllsc....",".dsscccscss....","...bb...bb....."],
    smith: [
      "....ssuuuu.....","...sbbuuuub....","...buuffFFub...","...uffFFxFf....","...buffFxFf....","....bubbbb.....","....uubbu......","...scsccsds....","..ssFcsccssf...","..ffFcsccsfF...","..fsucccss.F...","....gggGgb.....","...ssccccsb....","...sscusscb....","...bsccccb.....","....bb..bb.....","...bbb..bbb...."],
    mechanic: [
      "....scccsc.....","...scclllcc....","...ccclucccc...","..dggGGggGg....","..sugAAggAg....","...bufFFxFf....","...bfffFxF.....","....dfffF......","...sccgsccc....","..scclcgccsF...","..FsssggscsF...","..fffbbGgb.....","...dcssscc.....","...scssccs.....","...dssddss.....","....bb..bb.....","...bbb..bbb...."]
  };
  function lamp(c,x,y){
    rect(c,x-2,y-2,5,2,INK); rect(c,x-1,y-3,3,1,"#ae8655"); rect(c,x-3,y,7,7,INK);
    rect(c,x-2,y,5,5,"#ba7343"); rect(c,x-1,y+1,3,4,"#ffd780"); rect(c,x,y+2,1,3,"#fff1b3");
    rect(c,x-2,y+6,5,1,"#d8a260"); rect(c,x-1,y+7,3,1,INK);
  }
  function hero(c,id,x,y,w){
    const pal={...BASE,...suits[id]};
    const kind=({herbalist:"hood",ranger:"hood",sporeMage:"mage",starMage:"mage"})[id]||id;
    const rows=bodies[kind], ox=Math.round(x)-7, oy=Math.round(y)-rows.length;
    sprite(c,rows,ox,oy,pal);
    if(id==="hood"){line(c,x+6,y-8,x+8,y-10,"#966b49"); lamp(c,x+9,y-8);}
    if(id==="knight"){
      sprite(c,[".GGG.","GclcG","GchcG","GcccG",".GcG.","..G.."],x-8,y-10,pal);
      line(c,x+7,y-7,x+13,y-14,INK);line(c,x+8,y-8,x+13,y-13,"#d2d9ce");
      line(c,x+6,y-8,x+8,y-6,pal.g);
    }
    if(["mage","sporeMage","starMage","herbalist"].includes(id)){
      line(c,x+8,y-1,x+9,y-15,INK);line(c,x+9,y-1,x+10,y-14,"#b28a60");
      const gem=id==="sporeMage"?"#d9a6d4":w.magic;
      if(id==="herbalist"){sprite(c,["..l.",".cl.","cc.."],x+8,y-18,{c:"#779f75",l:"#c8e3ae"});}
      else {sprite(c,[".l.","chc",".c."],x+9,y-17,{c:w.metal,l:gem,h:"#fff1c5"});}
      if(id==="sporeMage") {sprite(c,["...sss...","..ccclc..",".lhccclc.","cllcccllc"],x-5,y-19,pal);}
    }
    if(id==="ranger"){
      line(c,x+8,y-12,x+11,y-8,"#cead7b");line(c,x+11,y-8,x+8,y-4,"#cead7b"); line(c,x+8,y-11,x+8,y-5,"#897a69");
      sprite(c,["..l.",".hl.","ll.."],x-2,y-20,pal);
    }
    if(id==="smith"){
      line(c,x+6,y-4,x+10,y-14,"#b38565");
      sprite(c,[".AAA...","AcccAA.","AcccccA","..ddccA"],x+7,y-17,pal);
    }
    if(id==="mechanic"){
      line(c,x+5,y-6,x+11,y-13,"#b3c1ca"); sprite(c,["A..A","AAAA",".AA."],x+10,y-15,pal);
    }
    if(id==="starMage") star(c,x+1,y-15,"#efd191",1);
  }

  const foes={
    bone:["..ddaa....",".saAAwa...","saAwwAAs..","sAAxxAxA..",".aaxxaxa..","..aAAa....","...wd.....","..adwaa...",".adwaawd..","a.dwwad.a.","..dawa...a","..awdwa...","...a.a....","..aa..aa.."],
    bat:["s.............s","cs...........sc",".lc.........cl.",".scc..s.s..ccs.","..scc.csc.ccs..","..clccclccclc..","...dssGxGssd...",".....sscss.....","......wcw......",".......s......."],
    cap:["....ccccc....","..cclhlllcc..",".cclllcclllc.","clwclcclhwllc","ssccclllcccss",".dscccssscs..","...ullhuu....","...uGuxGu....","...uuhhuu....","..sussuusu...","..suus.usu...","..dd....dd..."],
    beetle:["....l...l....",".....c.c.....","...scclccs...",".scccllhcccs.","scccllclllccs","dscllcxlclcsd",".sscccxcscss.","dd.ssGxGss.dd","...dsccsd....","..dd....dd..."],
    drone:["...a...a....","....A.A.....","..aaGGAaa...",".aAdcccdAa..","AadGGGGGdaA.","aadcGxGcdAa.",".adccccda...","..aGaaGa....",".aA....Aa...","aa......aa.."],
    spark:["....l.....","...ll..c..","..clc.cl..",".clhlccc..","cclhhlclc.","ccGxGcllc.",".cclhllc..","..dcccd...","...d.d...."]
  };
  const FOEPAL={
    ghost:{s:"#6b86a3",c:"#a6c2d8",l:"#d3e6f0",h:"#f4fcff"},
    slime:{s:"#3b7a55",c:"#6cc07c",l:"#a5e28f",h:"#e2fcc2"},
    goblin:{s:"#456a33",c:"#78a63e",l:"#abd05a",G:"#ffd84d"},
    mimic:{b:"#5e3a30",u:"#9a5d40",G:"#f2c864",r:"#a82f49",t:"#ec6d82",w:"#f6ecd2",G2:"#ffe08a"}
  };
  function foe(c,id,x,y,w){
    const p={...BASE,...(FOEPAL[id]?FOEPAL[id]:id==="bone"?{a:"#aa9f8b",A:"#d6cab2",w:"#f2dfb8"}:
      id==="bat"?{s:"#4c455c",c:"#756282",l:"#a590a1",G:"#ffd587"}:
      id==="cap"?{s:"#695276",c:"#9574a1",l:"#c890b2",h:"#f1bacc",u:"#8da08c",G:"#253e45"}:
      id==="beetle"?{s:"#34675e",c:"#4c9081",l:"#82c9a6",h:"#c7f0bf",G:"#f5ce73"}:
      id==="drone"?{a:"#847e92",A:"#b9b5c3",c:"#6c617f",G:"#edb679"}:
      {s:"#875e7c",c:"#b27685",l:"#e2a785",h:"#ffcea1",G:"#4a3043"})};
    const rows=foes[id];sprite(c,rows,x-Math.floor(rows[0].length/2),y-rows.length,p);
  }
  function boss(c,id,x,y,w){
    c.save(); c.translate(Math.round(x),Math.round(y));
    if(id==="king"){
      poly(c,[[-5,-28],[4,-29],[13,-21],[16,-4],[24,0],[14,-1],[11,1],[5,-4],[-4,0],[-12,-2],[-18,1],[-12,-18]],INK);
      poly(c,[[-4,-26],[5,-27],[12,-20],[14,-5],[18,-1],[10,-3],[7,-12],[5,-3],[-1,-4],[-10,-2],[-13,-4],[-9,-17]],"#704957");
      poly(c,[[-1,-22],[4,-24],[9,-18],[11,-4],[7,-6],[3,-17],[-1,-6],[-7,-4]],"#a06369");
      for(const [dx,h] of [[-10,7],[-6,11],[4,12],[10,8]]){
        line(c,dx,-3,dx+(dx<0?2:-2),-h,"#aa7474");rect(c,dx,-3,2,1,"#d0a775");
      }
      line(c,-7,-16,-2,-11,"#d4a66f");line(c,-2,-11,5,-16,"#d4a66f");
      sprite(c,["g...G...g",".GgGGGgG.",".GGGGGGG.","..aaAAA..",".aAwwwwA.",".AwxxAxxA",".AAxxAxxA","..AAxwAA.","...AwAw..","..ggGGgg.","sGaaAAaaG","..AwwAw..","..ddAdd..","...A.A..."],-5,-34,BASE);
      line(c,-10,-3,-14,-24,"#bc9560");star(c,-14,-25,"#ffcc7d",2);
      sprite(c,[".aaAA","aaAAw",".addd"],6,-23,BASE);
    } else if(id==="matron"){
      for(let i=0;i<6;i++){
        const dx=i*5-13;
        poly(c,[[dx-3,-12],[dx+2,-12],[dx+3,-4],[dx+7,0],[dx+1,-1],[dx-2,-4],[dx-5,-1]],"#394d48");
        line(c,dx,-9,dx+1,-4,"#88a789");
      }
      poly(c,[[-8,-19],[7,-19],[12,-11],[8,-4],[0,-7],[-11,-3],[-12,-11]],"#889d83");
      for(const [dx,dy] of [[-10,-8],[-7,-12],[8,-10],[5,-7]]){
        line(c,dx,dy,dx-2,dy+3,"#617f70");rect(c,dx-1,dy+2,2,1,"#b5c6a6");
      }
      sprite(c,["..G...G..",".cGc.cGc.","..ccccc..","...hh...."],-5,-15,{G:"#d7efab",c:"#3c625c",h:"#d8cda0"});
      poly(c,[[-21,-18],[-18,-23],[-14,-27],[-7,-31],[-1,-34],[5,-33],[12,-30],[17,-25],[22,-19],[20,-16],[9,-15],[-4,-16],[-15,-15]],INK);
      poly(c,[[-19,-19],[-13,-26],[-3,-32],[5,-31],[12,-27],[20,-20],[15,-18],[4,-18],[-10,-17]],"#986f9d");
      poly(c,[[-16,-20],[-10,-26],[-2,-30],[2,-30],[-3,-25],[-9,-20]],"#d69bb4");
      for(const [sx,sy] of [[-11,-23],[-2,-25],[5,-28],[10,-23],[14,-20]]){
        rect(c,sx,sy,3,2,"#f2c4ca");rect(c,sx+1,sy-1,2,1,"#f8d2cd");
      }
      line(c,-18,-18,-7,-17,"#e5b9be");line(c,4,-17,16,-18,"#bcd2b0");
      for(const dx of [-15,-10,-5,4,9,14])line(c,dx,-17,Math.round(dx*.72),-16+(dx%2),"#e2b9c0");
      for(const [dx,dy] of [[-12,-8],[12,-7]])sprite(c,[".ll.", "clhc", ".u.."],dx,dy,{c:"#876987",l:"#cca7af",h:"#f2d5ce",u:"#b6c7a0"});
    } else {
      const metal={...BASE,a:"#65667e",A:"#a4a3b7",w:"#d4cbd6",c:"#887796",l:"#b5a4c4",g:"#ba845f",G:"#efb482"};
      sprite(c,[".g...g.",".GGGGG.","aAwwwAa","AaGxGaa","aaaAaaa"],-4,-32,metal);
      for(const dx of [-14,7]){
        sprite(c,["..gGGg..",".aAAAwa.","aAwwwAAa","AccccAaa",".aAAaaa.","..aGGg..","..aAAa..",".aAAAaa.",".AdddAa."],dx,-25,metal);
        rect(c,dx+2,-16,4,6,"#747082"); rect(c,dx+1,-11,7,4,"#a59caf");
      }
      sprite(c,["..aaAAAAaa..",".aAAwwwwAAa.","aAaggGGggaAa","AAggGllGggAA","AagGllhlGgaA",".aagGllGgaa.","..aggGGgga..","...aaaaaa...","..aaggaaGa..","..Aaa..aaA..",".aAAa..aAAa.","aAAAa..aAAAa"],-6,-25,metal);
      for(const dx of [-7,2]){
        sprite(c,[".aGGa.",".AwwAa",".aAAad","..Acc.",".aGGaa","aAwwAA","adddda"],dx,-13,metal);
        sprite(c,[".aAa.","aAAaa","adgda","dddddd"],dx,-6,metal);
      }
      for(const dx of [-14,8])sprite(c,[".aAAa.","aAwwAa","aaggAa","ddaddd"],dx,-11,metal);
      star(c,0,-21,"#fae0b9",2);
    }
    c.restore();
  }
  const padRows=rows=>{const n=Math.max(...rows.map(r=>r.length));return rows.map(r=>r.padEnd(n,"."));};
  Object.assign(foes,{
    ghost:padRows(["....cccc....","..cllllllc..",".cllhhhllcs.",".clhhhhhlcs.",".clxxlhxxcs.",".clxxlhxxcs.",".cllllxllcs.",".cllllllccs.",".clllllllcs.",".cclcllclcs.","..sc.cc.cs..","...s.ss.s..."]),
    slime:padRows(["....cccccc....","..ccllhhllcc..",".cllhhlllllcs.",".clhllllllllcs","clllxllllxllcs","clllxllllxllcs","clllllhhllllcs","sclllllllllcss",".ssccccccccss."]),
    goblin:padRows(["s...........s","ss..ccccc..ss",".sccllllllcs.","..clGxllGxlc.","..cllllllllc.","...cldddddc..","....ccccc....","..bbbcccbbb..",".bubbcccbbub.","..uu.ccc.uu..","..dd.....dd.."]),
    mimic:padRows(["..dbbbbbbbbd..",".dbuuuuuuuubd.","dbuGxuuuuxGubd","dbuuGuuuuGuubd","dwdwdwdwdwdwdd","drrrrrrrrrrrrd","drrrttttttrrrd","dwdwdwdwdwdwdd","dbuuuuuuuuuubd","dbuuGuuuuGuubd",".dddddddddddd."])
  });
  const THING={
    grave:{rows:["..aaaa..",".aAAAAa.","aAAxxAAa","aAAxxAAa","aAxxxxAa","aAAxxAAa","aAAxxAAa","aAAAAAAa","ddddddddd"],pal:{a:"#8a93a0",A:"#cfd5da",x:"#6a7380",d:"#4b4540"}},
    coin:{rows:["..gGGg..",".gGhhGg.","gGhGGGGg","gGhGGGGg","gGGGGGGg",".gGGGGg.","..gggg.."],pal:{g:"#a9712f",G:"#f0c15e",h:"#fff1b0"}},
    potion:{rows:["..uu..","..dd..",".dwwd.","dppppd","dpPPpd","dpPPpd",".dppd."],pal:{u:"#b08a5a",d:"#49373b",w:"#eee0bd",p:"#d8486a",P:"#ff9bb0"}},
    scroll:{rows:["wwwwwww.","wWWWWWWw",".WbWbWW.",".WWWWbW.",".WbWWWW.","wWWWWWWw",".wwwwwww"],pal:{w:"#cdb58a",W:"#f2dfb8",b:"#8a5b3d"}},
    gem:{rows:["..cCc..",".cChhCc","cChCCCc","cCCCCCs",".cCCCs.","..cCs..","...s..."],pal:{c:"#5fb7d6",C:"#8fe0f0",h:"#ffffff",s:"#2e7a99"}},
    crown:{rows:["g..g..g.","gGggGgGg","gGGGGGGg","gGrGGrGg","gggggggg"],pal:{g:"#c8902f",G:"#f6cd7d",r:"#d9485f"}}
  };
  function thing(c,id,x,y){
    const t=THING[id],rows=padRows(t.rows);
    sprite(c,rows,Math.round(x)-Math.floor(rows[0].length/2),Math.round(y)-rows.length,{...BASE,...t.pal});
  }
  function chest(c,x,y,w,opened=false,final=false){
    c.save(); c.translate(Math.round(x),Math.round(y));
    const brass=final?"#f1c66e":w.metal, hi=final?"#ffe9a3":mix(brass,"#ffffff",.36);
    const wood=w.wood||(w.kind==="grove"?"#526d58":w.kind==="forge"?"#645775":"#975c42"), shade=mix(wood,INK,.46);
    poly(c,[[-11,-9],[-6,-12],[10,-12],[12,-9],[12,-2],[7,1],[-10,0]],INK);
    poly(c,[[-9,-9],[7,-8],[7,-1],[-9,-2]],wood); poly(c,[[7,-8],[11,-10],[11,-3],[7,-1]],shade);
    line(c,-8,-5,6,-5,shade);rect(c,-8,-3,13,1,mix(wood,brass,.35));
    for(const dx of [-7,4]){rect(c,dx,-8,2,7,brass);rect(c,dx,-8,1,6,hi);}
    if(!opened){
      poly(c,[[-11,-8],[-11,-11],[-8,-15],[-4,-16],[9,-15],[12,-12],[12,-9],[7,-6],[-9,-7]],INK);
      poly(c,[[-9,-10],[-6,-14],[7,-14],[9,-12],[8,-9],[6,-8],[-9,-9]],wood);
      rect(c,-6,-13,12,1,mix(wood,brass,.72));poly(c,[[8,-13],[10,-12],[10,-10],[7,-8]],shade);
      for(const dx of [-6,4]){line(c,dx+2,-14,dx-1,-11,hi);rect(c,dx-1,-11,2,3,brass);}
      line(c,-9,-8,6,-7,hi);line(c,7,-8,11,-10,brass);
    } else {
      poly(c,[[-10,-11],[-12,-19],[-10,-22],[6,-22],[9,-19],[10,-12],[7,-11]],INK);
      poly(c,[[-9,-13],[-10,-20],[5,-20],[7,-18],[8,-13]],shade);
      line(c,-10,-21,5,-21,hi);line(c,-10,-20,-8,-13,brass);line(c,6,-20,8,-13,brass);
      poly(c,[[-9,-10],[-4,-13],[10,-12],[6,-9]],"#ffdb8a");
      for(const [dx,dy,k] of [[-6,-12,0],[-3,-14,1],[1,-12,2],[4,-13,0],[7,-13,2]]){rect(c,dx,dy,3,3,[hi,w.magic,"#e79979"][k]);rect(c,dx,dy,1,1,"#fff3c7");}
    }
    rect(c,-2,-8,4,5,INK); rect(c,-2,-8,3,4,brass);rect(c,-1,-7,1,2,shade);
    if(w.kind==="grove"){line(c,-8,-4,-5,-6,"#9bb787");rect(c,-5,-7,2,1,"#c2d6a2");rect(c,7,-7,2,1,"#9ec2a2");}
    if(w.kind==="forge"){rect(c,-8,-4,2,1,"#cdc3eb");rect(c,4,-4,2,1,"#cdc3eb");}
    if(final){
      rect(c,-2,-8,3,3,hi);rect(c,-1,-7,1,1,w.magic);
      for(const dx of [-10,7]){rect(c,dx,-4,2,2,hi);rect(c,dx,-2,3,1,brass);}
      if(!opened){poly(c,[[-5,-15],[-7,-18],[-4,-17],[-2,-20],[0,-17],[3,-19],[2,-15]],brass);rect(c,-2,-17,2,2,w.magic);}
    }
    c.restore();
  }
  function item(c,id,x,y,w){
    c.save();c.translate(Math.round(x),Math.round(y));
    const gold=w.metal, light=mix(w.magic,"#fff1c5",.42);
    switch(id){
      case "key":
        sprite(c,["..GGG.......",".Gh.hG......",".G...G......","..GGGG......",".....GG.....","......GG....",".......GG.G.","........GG..",".........GG."],-5,-5,{G:gold,h:light}); break;
      case "leaf": case "seed":
        sprite(c,[".......l",".....clc","...clhlc","..ccllcs",".ccllcsc",".cclccs.","..cccs..",".cs.....","s......."],-4,-4,{s:"#47635b",c:"#80a478",l:"#abcea0",h:"#dbedb7"}); if(id==="seed")star(c,3,-5,"#fff3bc",2);break;
      case "shard": case "nova":
        sprite(c,[".....h..","....hlc.","...hllc.","..hllcc.","..llccs.",".clccs..",".cccs...","..cs....","..s....."],-4,-4,{h:light,l:w.magic,c:gold,s:mix(gold,INK,.45)});if(id==="nova"){star(c,-4,-3,light,2);star(c,5,3,gold,1);}break;
      case "spore": case "mushroom":
        sprite(c,["....ccc....","..cccllcc..",".clhllcclc.","cllccllhllc","ssccclcccss","..uullluu..","....ulh....","....ulh....","...uuulu..."],-5,-5,{s:"#655274",c:"#9d739c",l:"#d599b5",h:"#f3c3c6",u:"#89a28c"});break;
      case "gear": case "seal": case "sun":
        sprite(c,["....GG....",".G.GhhG.G.","..GhhllG..",".GhllcllG.","GGhlccllGG","GGhlccllGG",".GllccllG.","..GllllG..",".G.GllG.G.","....GG...."],-5,-5,{G:gold,h:light,l:mix(gold,w.magic,.6),c:id==="sun"?"#fff1b5":mix(gold,INK,.57)}); break;
      case "anvil": case "ingot":
        sprite(c,["....AAwwwAAA.","cccAAAAAAAccc",".cccAAAAAccc.","..cccAAAcc...",".....cc......","....cAAc.....","...ccAAcc...."],-6,-4,{w:"#e0cee3",A:"#a9a0bd",c:"#766986"});break;
      case "lamp":lamp(c,0,-1);break;
      case "gate":
        sprite(c,[".....g.....","...ggGgg...","..gG...Gg..",".gG..l..Gg.",".g..lll..g.",".g...l...g.","gg.......gg",".g.......g.",".g.......g.","GGG.....GGG"],-5,-5,{g:gold,G:light,l:w.magic});break;
      case "map":
        sprite(c,[".aa...aa.","a..aaa..a","a..a.a..a","a..a.a..a","a..a.a..a","a..aaa..a",".aa...aa."],-4,-3,{a:gold},false);break;
      case "book":
        sprite(c,["cccc.cccc","c..ccc..c","c...c...c","c...c...c","c...c...c","cccc.cccc"],-4,-3,{c:gold},false);break;
    }
    c.restore();
  }

  // Isometric tile coordinates; z is measured in actual scene pixels.
  const iso=(u,v,z=0)=>[Math.round(216+(u-v)*17),Math.round(81+(u+v)*7.2-z)];
  const face=(c,pts,col)=>poly(c,pts.map(p=>iso(...p)),col);
  function edge(c,a,b,color){line(c,...iso(...a),...iso(...b),color);}
  function block(c,u,v,du,dv,h,z,top,left,right){
    face(c,[[u,v+dv,z+h],[u+du,v+dv,z+h],[u+du,v+dv,z],[u,v+dv,z]],left);
    face(c,[[u+du,v,z+h],[u+du,v+dv,z+h],[u+du,v+dv,z],[u+du,v,z]],right);
    face(c,[[u,v,z+h],[u+du,v,z+h],[u+du,v+dv,z+h],[u,v+dv,z+h]],top);
  }
  function tiles(w,i,j){
    if(i<0||j<0||i>=11||j>=9) return false;
    if(w.kind==="grove" && ((i>8&&j>6)||(i<2&&j>7)||(i===10&&j<2))) return false;
    if(w.kind==="forge" && ((i>8&&j>6)||(i<2&&j>7))) return false;
    return !(i>8&&j>7) && !(i===10&&j===7);
  }
  function floor(c,w,room){
    for(let depth=0;depth<19;depth++){
      for(let i=0;i<=10;i++){
        const j=depth-i; if(!tiles(w,i,j)) continue;
        const n=noise(i,j,room+1);
        const near=Math.max(0,1-Math.hypot(i-3,j-.8)/4.1,1-Math.hypot(i-7,j-.8)/3.9,1-Math.hypot(i-.8,j-6.3)/3.6);
        const cool=w.kind==="crypt"?"#414454":w.kind==="grove"?"#344f53":"#45415b";
        const stone=mix(cool,n>.44?w.tile:w.face,.27+n*.27);
        const seam=mix(w.face,INK,.60), fill=mix(stone,w.kind==="crypt"?"#c48455":w.light,near*near*.49);
        const thick=w.kind==="grove"?12+Math.floor(n*5):13, left=mix(w.face,INK,.24+n*.12),right=mix(w.face,INK,.46+n*.16);
        block(c,i,j,1,1,thick,-thick,seam,left,right);
        if(!tiles(w,i,j+1)){
          edge(c,[i,j+1,-3],[i+1,j+1,-3],mix(left,w.wall,.6));
          edge(c,[i+.12,j+1,-7],[i+.65,j+1,-7],mix(left,INK,.5));
          edge(c,[i+.47,j+1,-8],[i+.47,j+1,-12],mix(left,INK,.5));
        }
        if(!tiles(w,i+1,j)) edge(c,[i+1,j,-5],[i+1,j+1,-5],mix(right,INK,.5));
        const offset=n*.035;
        face(c,[[i+.035,j+.045+offset],[i+.975,j+.025],[i+.975,j+.965],[i+.04,j+.97]],fill);
        edge(c,[i+.07,j+.07],[i+.86,j+.06],mix(fill,w.light,.11));
        if(n<.19) {
          edge(c,[i+.1,j+.95],[i+.27,j+.62],seam);edge(c,[i+.27,j+.62],[i+.5,j+.68],seam);
          edge(c,[i+.5,j+.68],[i+.47,j+.44],seam);
        }
        const [x,y]=iso(i+.5,j+.5);
        for(let k=0;k<5;k++){
          const sx=Math.floor(noise(i*9+k,j,53)*16)-8, sy=Math.floor(noise(i,j*9+k,14)*6)-3;
          rect(c,x+sx,y+sy,noise(i+k,j,36)>.6?3:1,1,mix(fill,n>.45?w.light:INK,.10+.08*n));
        }
        if(w.kind==="grove" && (n>.64 || i===0 || j===1)){
          oval(c,x+2,y,5,2,mix(fill,w.moss,.65));
          for(let k=0;k<7;k++) rect(c,x-5+noise(i+k,j)*12,y-2+noise(i,j+k)*4,2,1,mix(fill,w.moss,.88));
        }
        if(w.kind==="forge" && ((i===3||i===8)&&j>1||j===3&&i>2)){
          edge(c,[i+.05,j+.23],[i+.91,j+.23],mix(w.metal,INK,.28));
          edge(c,[i+.05,j+.28],[i+.91,j+.28],mix(w.metal,w.magic,.22));
        }
      }
    }
  }
  function wall(c,w,side,len,seed){
    const dir=(t,d=0,z=0)=>side==="left"?[d,t,z]:[t,d,z];
    const point=(t,d,z)=>iso(...dir(t,d,z));
    const panel=(pts,col)=>poly(c,pts.map(p=>point(...p)),col);
    const stroke=(t1,z1,t2,z2,col,d=.025)=>line(c,...point(t1,d,z1),...point(t2,d,z2),col);
    const wp=side==="left"?w.face:w.wall;
    for(let i=0;i<len;i++){
      const n=noise(i,side==="left"?2:8,seed);
      const h=side==="left" ? (i>6?30:41) : (i>8?37:49);
      panel([[i,-.5,h],[i+1,-.5,h],[i+1,.02,h],[i,.02,h]],mix(wp,w.light,.24));
      panel([[i,.02,h],[i+1,.02,h],[i+1,.02,0],[i,.02,0]],mix(wp,INK,.48));
      for(let row=0;row<h/6;row++){
        const offset=row%2*.52;
        for(let b=-1;b<1;b++){
          const a=Math.max(i,i+b+offset), end=Math.min(i+1,i+b+offset+.97);
          if(end-a<.025) continue;
          const top=Math.min(h-.7,row*6+5.3), bottom=row*6;
          if(top<=bottom) continue;
          const v=noise(Math.floor(a*4)+row,i+row*7,seed);
          const brick=mix(wp,v>.5?"#a1999d":"#242532",Math.abs(v-.5)*.46);
          panel([[a,.03,top],[end,.03,top],[end,.03,bottom],[a,.03,bottom]],brick);
          if(v>.44) stroke(a+.03,top,end-.05,top,mix(brick,w.light,.17));
          if(v<.23) stroke(a+.07,bottom+1,a+.32,bottom+1,mix(brick,INK,.28));
        }
      }
      if(n>.6 && w.kind!=="forge"){
        const [mx,my]=point(i+.3,.08,h-.5);
        for(let k=0;k<5;k++) rect(c,mx-3+k,my+noise(i,k)*4,2,1+Math.floor(noise(k,i)*4),mix(w.moss,wp,.25));
      }
      stroke(i,3,i+1,3,mix(wp,w.light,.28));
      stroke(i,2,i+1,2,mix(wp,INK,.2));
    }
  }
  function pillar(c,w,u,v,h,seed){
    const light=mix(w.wall,"#c5b2a8",.30), left=mix(w.wall,w.face,.4), right=mix(w.face,INK,.23);
    block(c,u-.25,v-.25,.85,.85,4,0,light,left,right);
    block(c,u-.17,v-.17,.70,.70,3,4,light,left,right);
    for(let z=7;z<h-5;z+=6){
      const top=mix(w.wall,w.light,noise(z,seed)*.17);
      block(c,u-.09,v-.09,.54,.54,5.5,z,light,top,right);
      edge(c,[u-.05,v+.45,z+.5],[u-.05,v+.45,z+4.5],mix(top,w.light,.22));
      if((z-7)%12===0)edge(c,[u+.12,v+.45,z+3],[u+.27,v+.45,z+3],mix(top,INK,.28));
      if(z%3===1) edge(c,[u+.45,v-.03,z+3],[u+.45,v+.17,z+3],mix(right,INK,.25));
    }
    block(c,u-.18,v-.18,.74,.74,3,h-5,light,left,right);
    block(c,u-.24,v-.24,.86,.86,3,h-2,light,left,right);
    if(w.kind==="forge") block(c,u-.13,v-.13,.65,.65,2,h+1,w.metal,left,right);
    if(w.kind==="grove"){
      const [x,y]=iso(u+.42,v+.45,h-2);
      for(let k=0;k<3;k++) vine(c,x+k*2-5,y-1,6+k*3,w,k+seed);
    }
  }
  function arch(c,w,side,center,width,height,door=true){
    const P=(x,z,off=.105)=>side==="left"?iso(off,center+x,z):iso(center+x,off,z);
    const points=(a,col,off)=>poly(c,a.map(([x,z])=>P(x,z,off)),col);
    const stroke=(x,z,X,Z,col,off)=>line(c,...P(x,z,off),...P(X,Z,off),col);
    const a=width/2, spring=height-a*10;
    const opening=[[-a,0],[-a,spring],[-a*.8,spring+a*5],[-a*.5,height-2],[0,height],[a*.5,height-2],[a*.8,spring+a*5],[a,spring],[a,0]];
    points(opening,mix(w.dark,INK,.3));
    const tint=door?w.metal:mix(w.face,w.metal,.38);
    for(const s of [-1,1]){
      for(let j=0;j<spring;j+=6){
        const color=mix(tint,w.wall,.50+noise(j,s)*.23);
        points([[s*a,j],[s*(a+.29),j],[s*(a+.29),j+5.4],[s*a,j+5.4]],color);
        stroke(s*a,j+5.3,s*(a+.26),j+5.3,mix(color,w.light,.36));
      }
    }
    const ring=(angle,outer)=>[(a+(outer?.32:0))*Math.cos(angle),spring+(height-spring+(outer?4:0))*Math.sin(angle)];
    for(let q=0;q<9;q++){
      const t=q*Math.PI/9+.018, e=(q+1)*Math.PI/9-.015;
      const col=q===4?mix(tint,w.light,.3):mix(tint,w.wall,.58+.1*Math.cos(t));
      points([ring(t,false),ring(e,false),ring(e,true),ring(t,true)],col);
      const p=ring(t,true),p2=ring(e,true);stroke(...p,...p2,mix(col,w.light,.38));
    }
    if(door){
      for(let j=0;j<7;j++){
        const x=-a+.15+j*(width-.20)/7, roof=spring+(height-spring)*Math.sqrt(Math.max(0,1-(x/a)**2))-2;
        points([[x,.7],[x+.19,.7],[x+.19,roof],[x,roof-1]],mix(w.face,INK,.46+.08*(j%2)));
        stroke(x,.7,x,roof,mix(w.wall,INK,.24));
      }
      for(const z of [7,18]) {stroke(-a+.12,z,a-.11,z,mix(tint,INK,.38));stroke(-a+.1,z+1,a-.13,z+1,mix(tint,INK,.13));}
      const [x,y]=P(0,14); rect(c,x-2,y-1,4,5,INK);rect(c,x-1,y,2,2,w.metal);rect(c,x,y+2,1,2,w.metal);
    } else {
      for(const t of [-.20,.15]) stroke(t,1,t,height-4,mix(w.face,INK,.33));
    }
  }
  function banner(c,w,left,center){
    const P=(u,z)=>left?iso(.14,center+u,z):iso(center+u,.14,z);
    const ends=[[-.44,37],[.44,37],[.44,18],[0,14],[-.44,18]];
    poly(c,ends.map(a=>P(...a)),w.kind==="crypt"?(w.lair?"#7a2f2f":w.graves?"#3f5d58":"#74434e"):w.kind==="grove"?"#4a716b":"#62557c");
    line(c,...P(-.45,37),...P(.46,37),w.metal);
    line(c,...P(-.37,35),...P(-.37,20),mix(w.metal,INK,.24));
    const [x,y]=P(0,26);
    if(w.graves){rect(c,x,y-3,2,9,w.metal);rect(c,x-2,y-1,6,2,w.metal);}
    else if(w.lair){sprite(c,[".www.","wxwxw",".www.","..w.."],x-2,y-3,{x:INK,w:w.metal});}
    else{star(c,x,y,w.metal,2);rect(c,x,y+4,1,2,w.metal);}
  }
  function vine(c,x,y,len,w,seed){
    for(let k=0;k<len;k++){
      const sx=x+Math.round(Math.sin(k*.36+seed)*2);
      rect(c,sx,y+k,1,1,mix(w.moss,INK,.42));
      if(k%3===1) rect(c,sx+(k%2?1:-2),y+k,2,2,mix(w.moss,w.magic,.12));
    }
  }
  function mushrooms(c,x,y,scale,w,seed){
    const paint=(dx,dy,s,light)=>{
      const X=x+dx,Y=y+dy;
      poly(c,[[X-s*.2,Y],[X-s*.05,Y-s*.7],[X+s*.16,Y-s],[X+s*.27,Y-s],[X+s*.12,Y-2],[X+s*.31,Y]],"#7c9990");
      line(c,X+s*.04,Y-3,X+s*.14,Y-s*.8,"#bdcab0");
      const cap=light?"#b78fae":"#8e7899";
      poly(c,[[X-s*.82,Y-s*.74],[X-s*.65,Y-s*1.05],[X-s*.2,Y-s*1.37],[X+s*.16,Y-s*1.46],[X+s*.48,Y-s*1.3],[X+s*.85,Y-s*.92],[X+s*.7,Y-s*.78],[X+s*.24,Y-s*.71],[X-s*.3,Y-s*.69]],INK);
      poly(c,[[X-s*.73,Y-s*.81],[X-s*.52,Y-s*1.08],[X-s*.18,Y-s*1.31],[X+s*.15,Y-s*1.38],[X+s*.48,Y-s*1.22],[X+s*.75,Y-s*.93],[X+s*.32,Y-s*.84],[X-s*.23,Y-s*.77]],cap);
      line(c,X-s*.68,Y-s*.79,X-s*.13,Y-s*.74,"#cfb1bf");line(c,X-s*.1,Y-s*.74,X+s*.55,Y-s*.83,"#a3bfae");
      for(let k=0;k<4;k++){ const t=k/4;rect(c,X+(-.49+t)*s,Y-s*(1.03+Math.sin(t*3)*.22),Math.max(1,s/8),1,"#ead6d1");}
    };
    paint(-scale*.48,1,scale*.58,false);paint(scale*.48,0,scale*.62,false);paint(0,0,scale,true);
  }
  function gear(c,x,y,r,w){
    for(let i=0;i<12;i++){const a=Math.PI*i/6;rect(c,x+Math.cos(a)*r-1,y+Math.sin(a)*r-1,3,3,w.metal);}
    oval(c,x,y,r-1,r-1,mix(w.metal,w.face,.55));oval(c,x,y,r-3,r-3,mix(w.face,INK,.20));
    for(let i=0;i<6;i++){const a=Math.PI*i/3;line(c,x,y,x+Math.cos(a)*(r-2),y+Math.sin(a)*(r-2),w.metal);}
    rect(c,x-1,y-1,3,3,w.magic);
  }
  function barrel(c,x,y,w){
    const wood=w.kind==="forge"?"#717081":"#895e4a", shade=mix(wood,INK,.42);
    poly(c,[[x-5,y-10],[x+3,y-12],[x+6,y-9],[x+5,y-1],[x,y+1],[x-5,y-1]],shade);
    oval(c,x,y-10,5,2,mix(wood,"#cfac84",.28));rect(c,x-4,y-8,3,7,wood);
    for(const k of [-7,-2]){line(c,x-5,y+k,x,y+k+1,w.face);line(c,x,y+k+1,x+5,y+k-1,w.face);}
  }
  function brazier(c,x,y,w,dwarf=false){
    const h=dwarf?6:11;
    oval(c,x,y,5,2,mix(w.face,INK,.5));rect(c,x-2,y-h,4,h,w.face);rect(c,x-1,y-h,1,h,mix(w.metal,w.wall,.45));
    poly(c,[[x-5,y-h-2],[x+6,y-h-2],[x+3,y-h+2],[x-2,y-h+2]],mix(w.metal,INK,.38));
    line(c,x-5,y-h-2,x+5,y-h-2,w.metal);
    return [x,y-h-3];
  }
  function flame(c,x,y,w,t,k){
    const n=Math.floor(t*6+k)%3, grove=w.kind==="grove", forge=w.kind==="forge";
    const base=grove?"#539f94":forge?"#ce775f":"#cf6b43", mid=grove?"#8ed4b3":"#f1a455",hi=grove?"#d7f6bd":"#ffdf94";
    poly(c,[[x-4,y],[x-4,y-3],[x-2,y-6],[x-1,y-4],[x+1,y-10-n],[x+2,y-6],[x+4,y-7+n],[x+4,y-3],[x+2,y]],base);
    poly(c,[[x-2,y],[x-2,y-4],[x,y-5-n],[x+1,y-8+n],[x+2,y-4],[x+2,y-1]],mid);
    rect(c,x-1,y-3,2,3,hi);rect(c,x,y-4,1,2,hi);
  }
  function rubble(c,x,y,w,k){
    for(let i=0;i<5;i++){
      const xx=x+noise(i,k)*13-6, yy=y+noise(k,i)*5-2, s=1+Math.floor(noise(k+i,k)*3);
      poly(c,[[xx-s,yy],[xx,yy-s],[xx+s,yy-1],[xx+s,yy+1],[xx-1,yy+2]],mix(w.face,w.wall,.65));
      line(c,xx-s,yy,xx,yy-s,mix(w.wall,w.light,.35));
    }
  }
  function floorSeal(c,w,u,v,size){
    const corners=[[u-size,v-size],[u+size,v-size],[u+size,v+size],[u-size,v+size]];
    corners.forEach((p,i)=>edge(c,p,corners[(i+1)%4],mix(w.tile,w.metal,.44)));
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {const [x,y]=iso(u+dx*size,v+dy*size);rect(c,x,y,2,1,w.metal);}
    const [x,y]=iso(u,v);line(c,x-8,y,x,y-4,mix(w.metal,w.tile,.45));line(c,x,y-4,x+8,y,mix(w.metal,w.tile,.45));line(c,x+8,y,x,y+4,mix(w.metal,w.tile,.45));line(c,x,y+4,x-8,y,mix(w.metal,w.tile,.45));
  }
  function backdrop(c,w,seed){
    const sky=c.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,mix(w.backdrop,"#252632",.2));sky.addColorStop(.58,w.backdrop);sky.addColorStop(1,mix(w.dark,INK,.12));
    c.fillStyle=sky;c.fillRect(0,0,W,H);
    glow(c,298,87,165,w.light,.09);
    // Two receding cave shelves frame the light at the centre.
    for(let layer=0;layer<2;layer++){
      const contour=[[-1,H]];
      for(let x=-1;x<W+12;x+=9){
        const dist=Math.abs(x-W*.52)/(W*.52);
        contour.push([x,Math.round(79+layer*41+24*Math.sin(x/61+seed*.16)-dist*46+noise(x,layer,7)*13)]);
      }
      contour.push([W+9,H]);poly(c,contour,mix(w.dark,w.backdrop,.72-layer*.29));
    }
    for(let i=0;i<24;i++){
      const x=Math.floor(noise(i,11,seed)*W),height=5+noise(i,31,seed)*25;
      const thick=3+noise(i,41,seed)*7;
      poly(c,[[x-thick,-1],[x+thick+3,-1],[x+thick,4],[x+2,height*.74],[x,height],[x-2,height*.52]],mix(w.dark,w.backdrop,.60));
    }
    for(const [x,y] of [[44,110],[409,87],[78,72],[19,175],[434,168]]){
      if(w.kind==="forge"){
        for(let k=-3;k<y-7;k+=6){rect(c,x,k,4,5,mix(w.dark,w.wall,.23));rect(c,x+1,k+1,2,3,w.backdrop);}
        gear(c,x+1,y-5,4,{...w,metal:mix(w.backdrop,w.metal,.31),face:w.dark,magic:mix(w.backdrop,w.magic,.3)});
      }else{
        const shade=mix(w.backdrop,w.wall,.25);
        poly(c,[[x-8,y],[x-3,y-7],[x+1,y-5],[x+4,y-20],[x+8,y-9],[x+11,y-7],[x+13,y]],shade);
        line(c,x+4,y-18,x+2,y-5,mix(shade,w.light,.1));
      }
    }
    for(let y=8;y<H;y+=8)for(let x=5;x<W;x+=10){
      const n=noise(x,y,seed);
      if(n>.6)rect(c,x+n*6,y+n*3,n>.94?2:1,1,mix(w.backdrop,w.light,(n-.45)*.24));
    }
    for(let k=0;k<9;k++) {
      const x=48+noise(k,seed,6)*338,y=48+noise(k,seed,7)*160;
      if((x<100||x>350)&&k%2===0)star(c,x,y,mix(w.backdrop,w.light,.36),1);
    }
  }
  function rootArch(c,w,seed){
    const p=(u,v,z)=>iso(u,v,z);
    const strokes=[
      [[3.35,.3,0],[3.6,.4,12],[3.54,.29,22],[3.9,.25,32],[4.45,.25,42],[5.15,.2,46],[5.62,.2,44]],
      [[7.0,.45,0],[6.69,.43,10],[6.71,.29,26],[6.36,.28,34],[5.9,.25,41],[5.15,.2,46],[4.9,.2,49]],
      [[2.65,.4,0],[3.32,.4,6],[3.49,.27,13],[3.54,.29,22],[3.11,.27,26],[2.89,.25,32]],
      [[7.5,.5,.6],[7.02,.4,3],[6.69,.43,10],[6.27,.40,15],[6.27,.35,20]]
    ];
    strokes.forEach((path,i)=>{
      const points=path.map(a=>p(...a));
      for(let j=1;j<points.length;j++){
        const [x,y]=points[j-1],[X,Y]=points[j],r=Math.max(1,4-Math.floor(j/2));
        for(let dx=-r;dx<=r;dx++)line(c,x+dx,y,X+dx,Y,dx===-r?"#9aad80":dx<0?"#667c65":dx===r?"#2d4644":"#4c6557");
        if(j>2&&i<2){vine(c,X,Y,4+Math.round(noise(j,i,seed)*5),w,j);rect(c,X-1,Y,2,1,w.magic);}
      }
    });
  }
  function furnace(c,w){
    const [x,y]=iso(5.14,.33,19);
    glow(c,x,y,32,"#ff994f",.37);
    const p=(u,z)=>iso(5.14+u,.28,z);
    poly(c,[[-.88,1],[-.88,18],[-.63,25],[-.20,29],[.32,26],[.85,20],[.85,2]].map(q=>p(...q)),"#af644d");
    poly(c,[[-.71,2],[-.67,13],[-.52,19],[-.3,13],[-.02,23],[.2,12],[.42,17],[.69,11],[.68,2]].map(q=>p(...q)),"#ec9860");
    poly(c,[[-.59,1],[-.55,8],[-.29,13],[-.12,9],[.19,15],[.49,8],[.53,1]].map(q=>p(...q)),"#ffd58a");
    for(const u of [-.68,-.23,.22,.66]){line(c,...p(u,0),...p(u,23),"#4d4655");line(c,...p(u+.055,0),...p(u+.055,23),"#a07969");}
    for(let n=0;n<3;n++)line(c,...iso(.15,1.2,18-n*3),...iso(.15,7.5,18-n*3),n===0?"#b18a75":n===1?"#6e565a":"#483c4a");
    for(const v of [1.9,4.1,6.2]){const [cx,cy]=iso(.18,v,16);rect(c,cx-1,cy-4,3,9,"#8c7b78");rect(c,cx,cy-3,1,7,"#b59a86");}
  }
  function amberMosaic(c,w,final){
    const stone=mix(w.tile,w.metal,final?.72:.44);
    for(const [u,v] of [[5.8,4.2],[1.9,2.2],[8.2,5.7]]){
      const [x,y]=iso(u,v);const r=u===5.8?(final?18:11):5;
      const points=[[x-r,y],[x,y-r*.42],[x+r,y],[x,y+r*.42]];
      points.forEach((a,i)=>line(c,...a,...points[(i+1)%4],stone));
      line(c,x-2,y,x,y-2,stone); line(c,x,y-2,x+2,y,stone);
    }
  }
  function gravestone(c,x,y,w,k){
    const stone=mix(w.wall,w.light,.22),shade=mix(w.face,INK,.3);
    poly(c,[[x-6,y+1],[x-6,y-10],[x-3,y-14],[x+3,y-14],[x+6,y-10],[x+6,y+1]],INK);
    poly(c,[[x-5,y],[x-5,y-10],[x-2,y-13],[x+2,y-13],[x+5,y-10],[x+5,y]],stone);
    rect(c,x+2,y-12,3,12,shade);rect(c,x-1,y-10,2,6,shade);rect(c,x-3,y-8,6,2,shade);
    rect(c,x-5,y-1,6,1,mix(w.moss,stone,.3));if(k>5)rect(c,x-4,y-10,2,1,mix(w.moss,stone,.4));
  }
  function skullPile(c,x,y,w){
    const pal={x:INK,w:"#d6cab2",s:"#9c8f84"};
    sprite(c,["..www..",".wwwww.","wxwwwxw","wwwxwww",".wwwww.","..w.w.."],x-3,y-7,pal);
    sprite(c,[".www.","wxwxw",".www."],x+4,y-2,pal);rubble(c,x-2,y+1,w,2);
  }
  function deadTree(c,x,y,h,w){
    const col=mix(w.dark,w.backdrop,.5);
    const br=(x0,y0,ang,len,th,d)=>{
      const x1=x0+Math.cos(ang)*len,y1=y0+Math.sin(ang)*len;
      for(let k=0;k<th;k++)line(c,x0+k,y0,x1+k,y1,col);
      if(d>0){br(x1,y1,ang-.55,len*.7,Math.max(1,th-1),d-1);br(x1,y1,ang+.5,len*.72,Math.max(1,th-1),d-1);}
    };
    br(x,y,-Math.PI/2+.05,h*.4,3,3);
  }
  function lairExtras(c,w){
    for(const path of [[[1.5,3],[2.4,3.5],[3.1,3.2],[3.8,4.4]],[[6,6.2],[6.9,6.6],[7.8,6.3],[8.6,7.1]],[[4.4,7.6],[5.2,7.1],[5.6,6.2]]]){
      for(let i=1;i<path.length;i++){
        const [x,y]=iso(...path[i-1]),[X,Y]=iso(...path[i]);
        line(c,x,y+1,X,Y+1,mix(w.dark,INK,.4));line(c,x,y,X,Y,mix(w.magic,"#fff1c7",.25));
        glow(c,(x+X)/2,(y+Y)/2,13,w.magic,.16);
      }
    }
    for(const [u,v] of [[3,.4],[6.6,.5],[9.2,2.4]]){
      const [x,y]=iso(u,v,64);
      for(let i=0;i<12;i++){rect(c,x+(i%2),y+i*3,2,2,i%2?"#8d8a97":"#5b5966");}
    }
  }
  function stageBase(w,room){
    const canvas=document.createElement("canvas"); canvas.width=W;canvas.height=H;
    const c=canvas.getContext("2d");backdrop(c,w,room+2);
    oval(c,241,178,152,36,mix(w.dark,w.backdrop,.28));
    floor(c,w,room);
    wall(c,w,"left",9,room+1);wall(c,w,"right",11,room+9);
    for(const center of [2.15,6.2])arch(c,w,"left",center,1.3,25,false);
    if(w.kind==="grove"){
      arch(c,w,"right",5.1,2.6,38,false);
      for(let i=1;i<17;i++){const [x,y]=iso(i*.57,.15,46);vine(c,x,y,4+Math.round(noise(i,room)*12),w,i);}
    }else{
      arch(c,w,"right",5.1,2.55,39,true);
      if(w.kind==="forge"){const [x,y]=iso(8,.19,26);gear(c,x,y,9,w);}
      else banner(c,w,false,8.05);
    }
    banner(c,w,true,4.6);
    for(const [u,v,h] of [[.03,.03,54],[.03,3.55,45],[3.1,.01,52],[6.95,.01,55],[10.45,.01,44],[.04,8.52,38]])pillar(c,w,u,v,h,room);
    if(w.kind==="grove")rootArch(c,w,room+1);
    else if(w.kind==="forge")furnace(c,w);
    else amberMosaic(c,w,room===13);
    floorSeal(c,w,5.8,4.2,1.3);
    if(room===13)floorSeal(c,w,5.8,4.2,1.9);
    const stepsV=.3;
    for(let k=0;k<3;k++) block(c,4.15,stepsV+k*.22,2.0,.25,3.5-k,0,mix(w.tile,w.light,.22),w.wall,w.face);
    for(let k=0;k<4;k++)block(c,2.0+k*.03,8.85+k*.18,1.6,.27,2,1-k*2.3,mix(w.tile,w.light,.16),w.wall,w.face);
    const lights=[], putFire=(u,v,small=false)=>{
      const [x,y]=iso(u,v); const source=brazier(c,x,y,w,small); lights.push(source);
      glow(c,...source,small?23:35,w.kind==="grove"?w.magic:"#ffc177",.39);
      glow(c,source[0],source[1]-3,8,w.kind==="grove"?w.magic:"#ffc177",.29);
    };
    putFire(3.25,.9);putFire(7.17,.87);putFire(.8,6.3,true);
    if(w.kind==="grove"){
      for(const [u,v,s] of [[.5,2.3,13],[1.1,5.75,16],[1,8.3,14],[8.1,.6,17],[9.5,1.2,12],[3.9,7.8,5]]){
        const [x,y]=iso(u,v);mushrooms(c,x,y,s,w,room);glow(c,x,y-s,15,w.magic,.09);
      }
    }else if(w.kind==="forge"){
      for(const [u,v] of [[1.2,3.3],[1.1,7.6],[8.8,1.2]]){
        const [x,y]=iso(u,v);gear(c,x,y-5,5,w);rubble(c,x+6,y+2,w,room+3);
      }
      const [x,y]=iso(9.55,2.1);block(c,9.15,1.75,.8,.7,4,0,w.wall,w.face,INK);item(c,"anvil",x,y-7,w);
    }else {
      for(const [u,v] of [[.9,2.4],[1.1,7.8],[8.2,.72],[8.75,.9]]) {const [x,y]=iso(u,v);if(w.graves)gravestone(c,x,y,w,u);else if(w.lair)skullPile(c,x,y,w);else barrel(c,x,y,w);}
      const [sx,sy]=iso(1.85,3.5);rubble(c,sx,sy,w,3);
    }
    for(const [u,v] of [[2.9,7.7],[10,3.2],[6.9,6.8]]){const [x,y]=iso(u,v);rubble(c,x,y,w,room+4);}
    if(w.graves){
      deadTree(c,38,150,92,w);deadTree(c,424,140,80,w);
      for(const [x,y,r] of [[130,196,60],[250,205,80],[360,190,60],[80,176,40]])glow(c,x,y,r,"#c4dcd5",.07);
      for(const [u,v] of [[2.2,4.6],[4.9,7.2],[8.4,6.3]]){const [x,y]=iso(u,v);gravestone(c,x,y,w,6);}
    }
    if(w.lair)lairExtras(c,w);
    return {canvas,lights};
  }
  // ---- этажи подземелья практики 6 ----
  const FLOORS={
    f1:{file:"f1",kind:"crypt",room:1,graves:true,light:"#9fc2c8",dark:"#13181d",wall:"#4c5660",face:"#38424d",tile:"#5b6670",moss:"#5f7f62",metal:"#b9c4c0",magic:"#a8e6d0",water:"#33454d",backdrop:"#1d262c"},
    f2:{file:"f2",kind:"crypt",room:2,light:"#edb564",dark:"#18171d",wall:"#555058",face:"#403d49",tile:"#686067",moss:"#747555",metal:"#daa65f",magic:"#ffd081",water:"#453c44",backdrop:"#29252c"},
    f3:{file:"f3",kind:"forge",room:3,light:"#aca6f6",dark:"#171a2c",wall:"#555675",face:"#393e57",tile:"#69657b",moss:"#7b8398",metal:"#d49464",magic:"#c4b7ff",water:"#423e68",backdrop:"#282740"},
    f4:{file:"f4",kind:"grove",room:4,light:"#8edac0",dark:"#101c25",wall:"#48515a",face:"#32434c",tile:"#50665f",moss:"#729271",metal:"#9bcf91",magic:"#a7f8d5",water:"#315865",backdrop:"#183032"},
    f5:{file:"f5",kind:"crypt",room:13,lair:true,light:"#f09a7a",dark:"#1d1214",wall:"#5e4547",face:"#46323a",tile:"#6e5557",moss:"#7a5a4c",metal:"#e6b36a",magic:"#ff8f6e",water:"#4a2f3c",backdrop:"#2c1a1f"}
  };
  function world(canvas,key,t){
    const w=FLOORS[key],c=canvas.getContext("2d");c.imageSmoothingEnabled=false;
    if(canvas._key!==key){canvas._key=key;canvas._stage=stageBase(w,w.room);}
    c.drawImage(canvas._stage.canvas,0,0);
    canvas._stage.lights.forEach(([x,y],k)=>flame(c,x,y,w,t,k));
    for(let i=0;i<16;i++){
      const xx=116+noise(i,w.room+2)*247+Math.sin(t*.45+i)*2,yy=60+((noise(i,3)*100-t*(1+i%3))%104+104)%104;
      const lum=Math.sin(t*1.5+i*3);if(lum>.18)rect(c,xx,yy,1,1,mix(w.wall,w.magic,.3+lum*.54));
    }
  }
  function mimicChest(c,x,y,w){
    c.save();c.translate(Math.round(x),Math.round(y));
    const wood="#8a5a3c",shade=mix(wood,INK,.46),brass=w.metal,hi=mix(brass,"#ffffff",.36);
    poly(c,[[-11,-9],[-6,-12],[10,-12],[12,-9],[12,-2],[7,1],[-10,0]],INK);
    poly(c,[[-9,-9],[7,-8],[7,-1],[-9,-2]],wood);poly(c,[[7,-8],[11,-10],[11,-3],[7,-1]],shade);
    line(c,-8,-5,6,-5,shade);rect(c,-8,-3,13,1,mix(wood,brass,.35));
    for(const dx of [-7,4]){rect(c,dx,-8,2,7,brass);rect(c,dx,-8,1,6,hi);}
    poly(c,[[-10,-11],[-12,-19],[-10,-22],[6,-22],[9,-19],[10,-12],[7,-11]],INK);
    poly(c,[[-9,-13],[-10,-20],[5,-20],[7,-18],[8,-13]],shade);
    line(c,-10,-21,5,-21,hi);line(c,-10,-20,-8,-13,brass);line(c,6,-20,8,-13,brass);
    poly(c,[[-9,-10],[-4,-13],[10,-12],[6,-9]],"#7a1f35");rect(c,-3,-11,6,2,"#e0607a");
    for(const dx of [-8,-5,-2,1,4,7]){rect(c,dx,-15,2,3,"#f4ead2");rect(c,dx,-15,1,1,"#ffffff");}
    for(const dx of [-7,-3,1,5]){rect(c,dx,-11,2,2,"#f4ead2");}
    rect(c,-6,-19,3,2,"#ffd84d");rect(c,1,-19,3,2,"#ffd84d");rect(c,-5,-19,1,2,INK);rect(c,2,-19,1,2,INK);
    c.restore();
  }
  function portalArt(c,w){
    const x=50,y=44;
    glow(c,x,y,34,w.magic,.3);
    poly(c,[[-17,22],[-17,-8],[-12,-19],[0,-26],[12,-19],[17,-8],[17,22]].map(([a,b])=>[x+a,y+b]),INK);
    poly(c,[[-15,22],[-15,-8],[-11,-17],[0,-24],[11,-17],[15,-8],[15,22]].map(([a,b])=>[x+a,y+b]),mix(w.wall,w.light,.2));
    for(let i=0;i<4;i++){
      const col=mix(w.magic,w.dark,.10+i*.17);
      poly(c,[[-14+i*3,13],[-14+i*3,-7],[-10+i*2,-15],[-3+i,-21+i*3],[3,-19+i*3],[11-i*2,-9],[13-i*3,5],[12-i*3,18]].map(([a,b])=>[x+a,y+b+4]),col);
    }
    for(let i=0;i<7;i++)rect(c,x-8+noise(i,1)*16,y+10-(i*5)%22,1,2,"#fff1c7");
  }
  const WP=FLOORS.f2;
  const TIERW={
    wood:{kind:"crypt",metal:"#c7a46a",magic:"#ffd081",wood:"#8a5a3c"},
    iron:{kind:"forge",metal:"#aab4c8",magic:"#c4b7ff",wood:"#5d6073"},
    gold:{kind:"crypt",metal:"#f1c66e",magic:"#ffd081",wood:"#975c42"},
    crystal:{kind:"grove",metal:"#9fe6f0",magic:"#c9f5ee",wood:"#4f6f8a"},
    boss:{kind:"forge",metal:"#f1c66e",magic:"#ff8f6e",wood:"#645775",final:true}
  };
  const HEROART={keeper:"hood",ranger:"ranger",alchemist:"herbalist",scribe:"mage"};
  const FOEART={skeleton:"bone",ghost:"ghost",slime:"slime",goblin:"goblin",bat:"bat",spore:"cap",beetle:"beetle",drone:"drone",wisp:"spark"};
  const spriteCache=new Map();
  function spriteFor(name){
    if(spriteCache.has(name))return spriteCache.get(name);
    const cv=document.createElement("canvas");cv.width=100;cv.height=90;
    const g=cv.getContext("2d");g.imageSmoothingEnabled=false;
    let type="item",ground=false;
    if(HEROART[name]){hero(g,HEROART[name],50,76,WP);type="hero";ground=true;}
    else if(FOEART[name]){foe(g,FOEART[name],50,76,WP);type="foe";ground=true;}
    else if(name==="boss"){boss(g,"golem",50,76,WP);type="boss";ground=true;}
    else if(name==="mimic"){mimicChest(g,50,76,TIERW.wood);type="chest";ground=true;}
    else if(name.startsWith("chest_")){
      const parts=name.split("_"),t=TIERW[parts[1]];
      if(!t)return null;
      chest(g,50,76,t,parts[2]==="open",!!t.final);type="chest";ground=true;
    }
    else if(name==="tomb"){thing(g,"grave",50,76);type="tomb";ground=true;}
    else if(THING[name]){thing(g,name,50,50);}
    else if(name==="key"){item(g,"key",50,45,WP);}
    else if(name==="portal"){portalArt(g,WP);type="portal";}
    else if(name==="spark"){star(g,50,45,"#ffd081",2);type="spark";}
    else return null;
    const data=g.getImageData(0,0,100,90).data;let x0=100,x1=-1,y0=90,y1=-1;
    for(let y=0;y<90;y++)for(let x=0;x<100;x++)if(data[(y*100+x)*4+3]>100){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(x1<0)return null;
    const bottom=ground?Math.max(y1+1,77):y1+1;
    const w=x1-x0+1,h=bottom-y0,out=document.createElement("canvas");out.width=w;out.height=h;
    out.getContext("2d").drawImage(cv,x0,y0,w,h,0,0,w,h);
    const r={canvas:out,w,h,type};spriteCache.set(name,r);return r;
  }
  return {world,sprite:spriteFor,FLOORS,tools:{rect,line,poly,mix,noise,glow,star,oval,flame,backdrop,INK}};
})();
/* <<< dungeon-art */

(function () {
  "use strict";
  /* >>> progress-codec (версия 84). Одинаковый блок в checker.js, theme.js, game.js, home.js:
     selftest.py сверяет копии, правится во всех четырех сразу. Глобального объекта нет, иначе
     прогресс подделывается одной строкой в консоли.
     Ключи practice-html-progress и practice-html-game* хранятся как "ph1:" + base64(XOR(подпись + JSON));
     подпись: два FNV-1a от секрета, ключа и JSON. Правка значения вручную делает его недействительным.
     Открытый JSON до версии 84 переводится один раз (отметка ph-m), потом не принимается.
     ponytail: защита от любопытных, не от подделки: секрет лежит в браузере, оценка ставится по репозиторию. */
  var progressCodec = (function () {
    var S = "3f9c-ph-7a1e-2026", MARK = "ph-m", PRE = "ph1:";
    function prot(k) { return k === "practice-html-progress" || k.indexOf("practice-html-game") === 0; }
    function fnv(s, h) {
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return ("0000000" + h.toString(16)).slice(-8);
    }
    function sig(k, s) { return fnv(S + k + s, 2166136261) + fnv(s + k + S, 84696351); }
    function xor(u8, k) {
      var key = S + k, out = new Uint8Array(u8.length);
      for (var i = 0; i < u8.length; i++) out[i] = u8[i] ^ key.charCodeAt(i % key.length) ^ (i * 31 & 255);
      return out;
    }
    function encode(k, v) {
      var s = JSON.stringify(v), u = xor(new TextEncoder().encode(sig(k, s) + s), k), b = "";
      for (var i = 0; i < u.length; i += 8192) b += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
      return PRE + btoa(b);
    }
    function decode(k, raw) {                       /* undefined: значение недействительно */
      if (raw.indexOf(PRE) !== 0) return undefined;
      try {
        var b = atob(raw.slice(PRE.length)), u = new Uint8Array(b.length);
        for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        var t = new TextDecoder().decode(xor(u, k)), s = t.slice(16);
        return t.slice(0, 16) === sig(k, s) ? JSON.parse(s) : undefined;
      } catch (e) { return undefined; }
    }
    try {                                           /* разовый перевод открытого JSON */
      var ls = window.localStorage;
      if (!ls.getItem(MARK)) {
        for (var i = 0; i < ls.length; i++) {
          var k = ls.key(i), raw = ls.getItem(k);
          if (k && prot(k) && raw && raw.indexOf(PRE) !== 0) {
            try { ls.setItem(k, encode(k, JSON.parse(raw))); } catch (e) { /* битый JSON оставляем */ }
          }
        }
        ls.setItem(MARK, "1");
      }
    } catch (e) { /* хранилище недоступно */ }
    return {
      get: function (k, def) {
        try {
          var raw = window.localStorage.getItem(k);
          if (raw == null) return def;
          if (!prot(k)) return JSON.parse(raw);
          var v = decode(k, raw);
          return v === undefined ? def : v;
        } catch (e) { return def; }
      },
      set: function (k, v) {
        try { window.localStorage.setItem(k, prot(k) ? encode(k, v) : JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ }
      },
      /* загрузка файла прогресса: открытый JSON из старого файла кодируется */
      importRaw: function (k, raw) {
        if (prot(k) && raw && raw.indexOf(PRE) !== 0) { try { raw = encode(k, JSON.parse(raw)); } catch (e) { return; } }
        try { window.localStorage.setItem(k, raw); } catch (e) { /* хранилище недоступно */ }
      }
    };
  })();
  /* <<< progress-codec */
  var W = 320, H = 84, GROUND = 66;
  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- спрайты (оригинальные) ---------------- */
  var PAL = {
    K: "#1A1C2C", W: "#F4F4F4", w: "#C9CCD6", S: "#F2B98B", H: "#6B3E26", G: "#41D6E8", P: "#2B59C3",
    B: "#3A2A22", b: "#2B6EC4", n: "#1C468C", f: "#2E7D46", F: "#215C34", x: "#BEA069", X: "#967A4C", g: "#39B54A", d: "#1F7A2E", y: "#F2C230", o: "#E08A00", r: "#D62839", c: "#8FE3F2", v: "#7A3FC8"
  };
  function sprite(rows) { return rows.map(function (r) { return r.split(""); }); }
  /* герой: полевой биолог в кепке и полевом жилете, с пробиркой (оригинальный персонаж) */
  var HERO_TOP = [
    "...bbbbb....",
    "..bbbbbbb...",
    "..bnbbbbbbbb",
    "..HSSSSSS...",
    "..HSKSSKS...",
    "...SSSSSS...",
    "....SSSS....",
    "..fWWWWWWf..",
    ".SffWWWWffSc",
    ".SffWWWWffSc",
    "..ffWWWWff..",
    "..fFFFFFFf.."
  ];
  var LEGS = {
    stand: ["...xxx.xxx..", "...xxx.xxx..", "...XX...XX..", "..BBB...BBB."],
    run1:  ["...xxx.xx...", "..xxx...xx..", ".XX......XX.", ".BB.......BB"],
    run2:  ["....xxxx....", "....xxx.....", "....XX.XX...", "...BBB.BB..."],
    jump:  ["..xxx..xxx..", "..XX....XX..", ".BB......BB.", "............"],
    hurt:  ["...xxx.xxx..", "..XX.....XX.", ".BB.......BB", "............"]
  };
  var HERO = {};
  Object.keys(LEGS).forEach(function (k) { HERO[k] = sprite(HERO_TOP.concat(LEGS[k])); });
  var BLOB = [
    sprite(["....gggg....", "..gggggggg..", ".gggggggggg.", ".ggWKggWKgg.", "gggWKggWKggg", "gggggggggggg", "gggggddggggg", ".gggggggggg.", ".g.g.gg.g.g."]),
    sprite(["............", "...gggggg...", ".gggggggggg.", "gggWKggWKggg", "gggWKggWKggg", "gggggggggggg", "gggggddggggg", "gggggggggggg", "g.g.g..g.g.g"])
  ];
  var TUBE = sprite([
    "...KKKKKK...", "...KwwwwK...", "....KwwK....", "....KccK....", "...KccccK...", "..KccccccK..",
    ".KcccccccK..", ".KccvvccccK.", "KccvvvvcccK.", "KcvvvvvvvcK.", "KvvvvvvvvvK.", "KvvvvvvvvvK.",
    ".KvvvvvvvK..", "..KKKKKKK..."
  ]);
  var GLYPH = {
    A: ["010", "101", "111", "101", "101"], T: ["111", "010", "010", "010", "010"],
    G: ["011", "100", "101", "101", "011"], C: ["011", "100", "100", "100", "011"]
  };
  var LETTERS = "ATGC";

  function drawSprite(ctx, spr, x, y, flip, outline) {
    var h = spr.length, w = spr[0].length;
    x = Math.round(x); y = Math.round(y);
    if (outline !== false) {
      ctx.fillStyle = PAL.K;
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
        if (spr[yy][xx] === ".") continue;
        var px = flip ? x + (w - 1 - xx) : x + xx;
        ctx.fillRect(px - 1, y + yy, 3, 1);
        ctx.fillRect(px, y + yy - 1, 1, 3);
      }
    }
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var c = spr[j][i];
      if (c === ".") continue;
      ctx.fillStyle = PAL[c] || c;
      ctx.fillRect(flip ? x + (w - 1 - i) : x + i, y + j, 1, 1);
    }
  }


  /* ---------------- тема «Рыцарь» (версия 72) ----------------
     Включается полем game_theme: "knight" в манифесте практики (build_manifest.py берет его
     из data-game-theme у <main> обзора). Рыцарь в стиле чиби вместо биолога, монстр на каждой
     странице (MONSTERS по номеру страницы), дракон с полосой здоровья на всю практику: деление
     за каждое упражнение своего уровня. На странице с драконом бой показан как цикл while с
     трассировкой; когда здоровье дракона 0, башня открыта и принцесса свободна. */
  var THEME = (window.PRACTICE_MANIFEST || {}).game_theme || "lab";
  var KPAL = {"a":"#E5484D","b":"#B9C0CF","c":"#E4E8F0","d":"#F4F6FA","e":"#2A2F45","f":"#FFFFFF","g":"#F2C230","h":"#3C6FD8","i":"#7A4A2A","j":"#4A4F63","k":"#59D46A","l":"#B8F5BF","m":"#1A1C2C","n":"#3BA84B","o":"#4FC0C8","p":"#BFF3F5","q":"#2E8F97","r":"#F1EEE4","s":"#C9C3B3","t":"#8A5BD6","u":"#5B3A9E","v":"#EEF1FA","w":"#F59AB8","x":"#6CC24A","y":"#8A5A2B","z":"#3A2A22","A":"#F6E7B0","B":"#A42A2A","C":"#E0453A","D":"#7A1E1E","E":"#F6C26B","F":"#B53328","G":"#F6CBA5","H":"#F07AB5","I":"#FFFFFE"};
  var KSPR = {
    knight_stand: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............",".....jj..jj.............",".....jj..jj............."],
    knight_run1: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............","...jj.....jj............","...jj......jj..........."],
    knight_run2: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............","......jjjj..............","......jjjj.............."],
    knight_jump: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............","....jj....jj............","........................"],
    knight_hurt: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............","...jj......jj...........","........................"],
    knight_strike: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbb..........","...bbbbbbbbbbb..........","..beeeeeeeeeebb.........","..beeefeeefeebb.........","..beeeeeeeeeebb.........","...bbbbbbbbbbb..........","...bbbbbbbbbbb..........","....bbbbbbbbb...........",".....bbbbbbb...g........","..bbhhhhhhhhbiigdddddddd","..bbhhhhhhhhbb.g........","..bbggggggggbb..........","....hhhhhhhh............",".....jj..jj.............",".....jj..jj............."],
    slime: ["..............","......kkk.....","....kkkkkkk...","...llkkkkkkk..","..kkkkkkkkkkk.","..kkffkkffkkk.",".kkkfmkkfmkkkk",".kkkfmkkfmkkkk",".kkkkkkkkkkkkk",".kkkkkkkkkkkk.",".nnnnnnnnnnnn."],
    slimeking: [".......g......","....g..g.g....","....ggaggg....","....gggggg....","......ooo.....","....ooooooo...","...ppooooooo..","..ooooooooooo.","..ooffooffooo.",".ooofmoofmoooo",".ooofmoofmoooo",".ooooooooooooo",".oooooooooooo.",".qqqqqqqqqqqq."],
    skeleton: ["..............","......rrr.....","....rrrrrrr...","...rrrrrrrrr..","...rrrrrrrrr..","..rrmmrrmmrrr.","..rrmmrrmmrrr.","..rrrrrrrrrrr.","...rrrrrrrrr..","...rrssssrrr..","....rrrrrrr...","...rrrrrrrr...",".....ssss.....",".....rrrr.....",".....r..r.....",".....r..r....."],
    bat: ["................","......t...t.....","uu....ttttt...uu","uuuuutttttttuuuu",".uuuuttftfttuuu.","..uuutttttttuu..",".....ttttttt....",".....tttdttt....","......ttttt.....","................"],
    ghost: ["......vvv.....","....vvvvvvv...","...vvvvvvvvv..","..vvvvvvvvvvv.","..vvvvvvvvvvv.",".vvveevveevvvv",".vvveevveevvvv",".vvveevveevvvv",".vvvvvvvvvvvv.",".vvwvvvvvvwvv.",".vvvvveevvvvv.",".vvvvvvvvvvvv.",".vv..vvvv.vvv.",".vv..vvv..vvv."],
    goblin: ["..............",".....xxxxx....","...xxxxxxxxx..","...xxxxxxxxx..","xxxxxxxxxxxxxx","xxxxggxxggxxxx","..xxgmxxmgxxx.","..xxxxxxxxxxx.",".iixxxxxxxxxx.",".iixxffffxxx..",".iixxxxxxxxx..",".ii.yyyyyy....",".ii.zzzzzz....",".ii.yyyyyy....",".....x..x.....",".....x..x....."],
    dragon: ["......................................","......................................",".........AA...........................",".........AA...AA..........BBBBBBB.....","........CAACC.AA..........BBBBBBB.....","......CCCCCCCCAA........BBBBBBBBB.....",".....CCCCCCCCCCC........BBBBBBBBB.....","....CCCCCCfffCCCC......BBBBBBBBBBBB...","....CCCCCfffffCCC......BBBBBBBBBBBB...","...CCCCCCffmffCCCC.....BBBBBBBBBBBB...","...CCCCCCffmffCCCC.CCCCCBBBBBBBBBBB...",".CCCCCCCCCfffCCCCCCCCCCCCCBBBBBBB.....",".CDCCCCCCCCCCCCCCCCCCCCCCCCCBBBBB.....",".CCCCCCCCCCCCCCCCCCCCCCCCCCCC.........",".CCCCCCCCCCCCCCCCCCCCCCCCCCCC.........",".CfCfCCCCCCCCCCCCCCCCCCCCCCCCC........",".....CCCCCCCCCCCCCEEECCCCCCCCC........","......CCCCCCCCCCEEEEEEECCCCCCCC.......","........CCCCCCCEEEEEEEEECCCCCCC....EE.","............CCCEEEEEEEEECCCCCCC...CCC.","............CCEEEEEEEEEEECCCCCC...CCC.","............CCEEEEEEEEEEECCCCCC...CCC.",".............CEEEEEEEEEEECCCCCCCCCC...",".............CCEEEEEEEEECCCCCCCCCCC...","..............CEEEEEEEEECCCCCCCCCCC...","..............CCEEEEEEECCCCCC.........","..............FFFFEEECCFFFFC..........","..............FFFFCCCCCFFFF...........","..............FFFF.CCCCFFFF...........","..............FFFF.....FFFF..........."],
    princess: [".....g..a.g.....",".....gggggg.....",".....gggggg.....","....ggggggggg...","....gggGGGggg...","...ggGGGGGGGgg..","...ggGGGGGGGgg..","...gGGGGGGGGGg..","...gGGmGGGmGGg..","...gGGGGGGGGGg..","....gwGGGGGwg...","....gGGGGGGGg...","......gGGGg.....","......HIIH......","...GG.HHHHHGG...",".....HHHHHH.....",".....HHHHHHH....","....HHHHHHHH....","....HHHHHHHHH...","...HHHHHHHHHH...","...HHHHHHHHHHH.."]
  };
  Object.keys(KSPR).forEach(function (k) { KSPR[k] = sprite(KSPR[k]); });
  var MONSTERS = ["slime", "skeleton", "ghost", "goblin", "bat", "goblinBig", "slimeking", "dragon"];
  function drawK(ctx, spr, x, y, flip, sc, tint, pal) {
    sc = sc || 1; pal = pal || KPAL; x = Math.round(x); y = Math.round(y);
    var h = spr.length, w = spr[0].length, xx, yy, X;
    ctx.fillStyle = PAL.K;
    for (yy = 0; yy < h; yy++) for (xx = 0; xx < w; xx++) {
      if (spr[yy][xx] === ".") continue;
      X = flip ? w - 1 - xx : xx;
      ctx.fillRect(x + X * sc - 1, y + yy * sc, sc + 2, sc); ctx.fillRect(x + X * sc, y + yy * sc - 1, sc, sc + 2);
    }
    for (yy = 0; yy < h; yy++) for (xx = 0; xx < w; xx++) {
      var ch = spr[yy][xx]; if (ch === ".") continue;
      X = flip ? w - 1 - xx : xx;
      ctx.fillStyle = tint || pal[ch]; ctx.fillRect(x + X * sc, y + yy * sc, sc, sc);
    }
  }
  function pageMonster() {
    var m = /t\d+_(\d+)\.html/.exec(PAGE), n = m ? +m[1] : 1;
    return MONSTERS[(Math.max(1, n) - 1) % MONSTERS.length];
  }
  function trackNow() {
    try { return JSON.parse(window.localStorage.getItem("practice-html-settings") || "{}").track || null; } catch (e) { return null; }
  }
  /* здоровье дракона: сколько упражнений своего уровня еще не решено (без уровня: упражнений, где не решен ни один вариант) */
  function dragonState() {
    var m = window.PRACTICE_MANIFEST;
    if (!m || !m.graded) return { left: 0, total: 0 };
    var s = solvedTasks(), tr = trackNow(), list;
    if (tr && m.graded[tr]) list = m.graded[tr].map(function (t) { return [t.file]; });
    else {
      var by = {};
      (m.exercises || []).forEach(function (t) { var k = t.page + "#" + (t.group || t.file); (by[k] = by[k] || []).push(t.file); });
      list = Object.keys(by).map(function (k) { return by[k]; });
    }
    var left = list.filter(function (fs) { return !fs.some(function (f) { return s[f]; }); }).length;
    return { left: left, total: list.length };
  }
  function drawMonster(c, mon, x, ground, t, tint) {
    var f = Math.floor(t / 14) % 2;
    if (mon === "slime") { drawK(c, KSPR.slime, x - 10, ground - 11 + f, true, 1, tint); drawK(c, KSPR.slime, x + 8, ground - 11 + (1 - f), true, 1, tint); }
    else if (mon === "skeleton") { for (var i = 0; i < 3; i++) drawK(c, KSPR.skeleton, x - 12 + i * 13, ground - 16, true, 1, tint); }
    else if (mon === "ghost") drawK(c, KSPR.ghost, x, ground - 22 + Math.round(Math.sin(t / 9) * 3), true, 1, tint);
    else if (mon === "goblin") drawK(c, KSPR.goblin, x, ground - 16, true, 1, tint);
    else if (mon === "bat") { for (var j = 0; j < 3; j++) drawK(c, KSPR.bat, x - 12 + j * 14, ground - 34 - j * 4 + Math.round(Math.sin(t / 7 + j) * 3), false, 1, tint); }
    else if (mon === "goblinBig") drawK(c, KSPR.goblin, x - 4, ground - 32, true, 2, tint);
    else if (mon === "slimeking") drawK(c, KSPR.slimeking, x - 4, ground - 28, true, 2, tint);
    else drawK(c, KSPR.dragon, x - 6, ground - 30 + (f ? 1 : 0), false, 1, tint);
  }
  function drawTower(c, x, ground) {
    c.fillStyle = PAL.K; c.fillRect(x - 1, ground - 51, 30, 51);
    c.fillStyle = "#8A90A3"; c.fillRect(x, ground - 50, 28, 50);
    c.fillStyle = "#6E7488";
    for (var r = 0; r < 10; r++) for (var q = 0; q < 4; q++) c.fillRect(x + q * 7 + (r % 2) * 3, ground - 48 + r * 5, 5, 1);
    for (var b = 0; b < 4; b++) { c.fillStyle = PAL.K; c.fillRect(x - 1 + b * 8, ground - 57, 7, 7); c.fillStyle = "#8A90A3"; c.fillRect(x + b * 8, ground - 56, 5, 6); }
    c.fillStyle = PAL.K; c.fillRect(x + 8, ground - 16, 12, 16); c.fillStyle = "#2A1E14"; c.fillRect(x + 9, ground - 15, 10, 15);
  }
  function loopKey() { return "practice-html-game:loop:" + PAGE; }
  function loopRows() { return progressCodec.get(loopKey(), []) || []; }
  function addLoopRow(ok) {
    var rows = loopRows(); rows.push({ ok: !!ok, hp: dragonState().left });
    progressCodec.set(loopKey(), rows.slice(-50));
  }
  function loopPanel(sc) {
    var box = sc.loopBox, d = dragonState(), rows = loopRows(), last = rows[rows.length - 1];
    var lines = ["hp = " + d.total + "   # упражнения вашего уровня", "while hp > 0:",
      "    решение = проверка()", "    if not решение:", "        continue", "    hp = hp - 1", "print(\"Принцесса свободна\")"];
    var on = d.left === 0 ? [1, 6] : !last ? [0] : last.ok ? [2, 5] : [2, 3, 4];
    box.innerHTML = "";
    var pre = document.createElement("pre"); pre.className = "game-loop-code";
    lines.forEach(function (l, i) { var s = document.createElement("span"); s.textContent = l; if (on.indexOf(i) >= 0) s.className = "is-on"; pre.appendChild(s); });
    var tb = document.createElement("table"); tb.className = "game-loop-trace";
    tb.innerHTML = "<thead><tr><th>Итерация</th><th>решение</th><th>hp</th></tr></thead>";
    var body = document.createElement("tbody");
    rows.slice(-6).forEach(function (r, i) {
      var tr = document.createElement("tr");
      [String(rows.length - Math.min(rows.length, 6) + i + 1), r.ok ? "True" : "False", r.hp + (r.ok ? "" : " (continue)")].forEach(function (v) { var td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
      body.appendChild(tr);
    });
    if (d.left === 0) { var tr0 = document.createElement("tr"); tr0.innerHTML = "<td colspan=\"3\">hp > 0 ложно: цикл окончен</td>"; body.appendChild(tr0); }
    tb.appendChild(body);
    box.appendChild(pre); box.appendChild(tb);
  }

  /* ---------------- звук (синтез, по умолчанию выключен) ---------------- */
  var audio = null;
  function beep(notes, type) {
    if (root.getAttribute("data-sound") !== "on") return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var t = audio.currentTime;
      notes.forEach(function (n, i) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = type || "square";
        o.frequency.value = n;
        g.gain.setValueAtTime(0.06, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.12);
        o.connect(g); g.connect(audio.destination);
        o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.13);
      });
    } catch (e) { /* звук недоступен */ }
  }
  var SFX = {
    coin: function () { beep([988, 1319]); },
    win: function () { beep([523, 659, 784, 1047, 784, 1047]); },
    fail: function () { beep([392, 330, 262], "triangle"); },
    jump: function () { beep([440, 660], "square"); }
  };

  /* ---------------- состояние уровня ---------------- */
  var PAGE = (window.location.pathname.split("/").pop() || "page");
  var STATE_KEY = "practice-html-game:" + PAGE;
  function loadState() {
    return progressCodec.get(STATE_KEY, {}) || {};
  }
  function saveState(st) {
    progressCodec.set(STATE_KEY, st);
  }
  var state = loadState();
  state.done = state.done || {};

  /* ---------------- механика: опыт, уровень героя, серия, значки ----------------
     Общая для всей практики (ключ practice-html-game). Опыт дается один раз
     за упражнение по его варианту: базовый 5, средний 8, продвинутый 12
     (VARIANT_XP; упражнение без вариантов 5).
     Серия считает задачи, решенные с первой попытки подряд; неверное решение
     опыт не отнимает, серия просто начинается заново. */
  var GAME_KEY = "practice-html-game";
  var XP = { exercise: 5, basic: 10, medium: 20, advanced: 30 };
  var TITLES = ["Лаборант", "Стажер", "Исследователь", "Аналитик", "Биоинформатик", "Профессор"];
  var PER_LEVEL = 50;
  var BADGES = {
    first: "Первая задача",
    streak5: "Серия из 5 с первой попытки",
    zone_basic: "Базовый уровень пройден",
    zone_medium: "Средний уровень пройден",
    zone_advanced: "Продвинутый уровень пройден",
    all: "Все упражнения практики во всех вариантах",
    flawless: "Страница без единой ошибки",
    star: "Первая задача со звездочкой",
    dragon: "Дракон повержен"
  };
  function loadG() {
    var g;
    g = progressCodec.get(GAME_KEY, {}) || {};
    g.xp = g.xp || 0; g.streak = g.streak || 0; g.best = g.best || 0;
    g.awarded = g.awarded || {}; g.attempts = g.attempts || {}; g.badges = g.badges || {};
    return g;
  }
  function saveG(g) { progressCodec.set(GAME_KEY, g); }
  function heroLevel(xp) { return Math.floor(xp / PER_LEVEL) + 1; }
  function heroTitle(xp) { return TITLES[Math.min(TITLES.length - 1, heroLevel(xp) - 1)]; }

  var toastBox = null;
  function toast(title, text) {
    if (root.getAttribute("data-profile") !== "game") return;
    if (!toastBox) { toastBox = document.createElement("div"); toastBox.className = "game-toasts"; toastBox.setAttribute("role", "status"); document.body.appendChild(toastBox); }
    var t = document.createElement("div");
    t.className = "game-toast";
    var b = document.createElement("b"); b.textContent = title; t.appendChild(b);
    if (text) { var p = document.createElement("span"); p.textContent = text; t.appendChild(p); }
    toastBox.appendChild(t);
    window.setTimeout(function () { t.className += " is-out"; }, 3800);
    window.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4400);
  }

  function award(detail) {
    var g = loadG(), f = detail.file, lvl = detail.level || "exercise";
    g.attempts[f] = (g.attempts[f] || 0) + 1;
    if (!detail.solved) {
      if (!g.awarded[f]) { if (g.streak > 1) toast("Серия прервана", "Ошибка не отнимает опыт. Подсказки проверки ниже."); g.streak = 0; }
      saveG(g); refreshHud(); return;
    }
    if (g.awarded[f]) { saveG(g); return; }
    var VARIANT_XP = { basic: 5, medium: 8, advanced: 12 };
    /* версия 72: задача со звездочкой необязательная, опыта за нее больше, чем за упражнение того же уровня */
    var STAR_XP = { basic: 10, medium: 15, advanced: 20 };
    var before = heroLevel(g.xp), gain = lvl === "exercise" ? (VARIANT_XP[detail.variant] || 5)
      : lvl === "star" ? (STAR_XP[detail.variant] || 10) : (XP[lvl] || 5);
    g.awarded[f] = { level: lvl, first: g.attempts[f] === 1 };
    if (g.attempts[f] === 1) { g.streak += 1; g.best = Math.max(g.best, g.streak); } else { g.streak = 0; }
    g.xp += gain;
    var got = [];
    function badge(key) { if (!g.badges[key]) { g.badges[key] = true; got.push(BADGES[key]); } }
    badge("first");
    if (lvl === "star") badge("star");
    if (g.streak >= 5) badge("streak5");
    var m = window.PRACTICE_MANIFEST;
    if (m) {
      var allDone = true;
      Object.keys(m.graded).forEach(function (lv) {
        var list = m.graded[lv] || [];
        var done = list.length && list.every(function (t) { return g.awarded[t.file]; });
        if (done) badge("zone_" + lv); else allDone = false;
      });
      if (allDone) badge("all");
      var here = (m.pages.filter(function (pg) { return pg.href === PAGE; })[0] || { tasks: [] }).tasks;
      if (here.length && here.every(function (t) { return g.awarded[t.file] && g.awarded[t.file].first; })) badge("flawless");
    }
    saveG(g);
    toast("+" + gain + " XP" + (g.streak > 1 ? " · серия ×" + g.streak : ""),
      heroLevel(g.xp) > before ? "Новый уровень: " + heroLevel(g.xp) + " · " + heroTitle(g.xp)
        : "До уровня " + (heroLevel(g.xp) + 1) + " осталось " + (PER_LEVEL - g.xp % PER_LEVEL) + " XP");
    if (THEME === "knight" && !g.badges.dragon && dragonState().total && !dragonState().left) {
      g.badges.dragon = true; saveG(g);
      toast("Дракон повержен!", "Принцесса свободна: все упражнения вашего уровня решены, практику можно сдавать.");
    }
    got.forEach(function (b) { toast("Значок: " + b); });
    refreshHud();
  }

  /* HUD в верхней панели: уровень, опыт, серия, звезды за упражнения своего уровня */
  function refreshHud() {
    var box = document.querySelector(".topbar .tb-game");
    if (!box) return;
    var g = loadG(), m = window.PRACTICE_MANIFEST;
    box.innerHTML = "";
    function pill(text, cls) { var s = document.createElement("span"); s.className = "hud-pill" + (cls ? " " + cls : ""); s.textContent = text; box.appendChild(s); return s; }
    pill("Ур. " + heroLevel(g.xp) + " · " + heroTitle(g.xp));
    var xp = pill("XP ", "hud-xp");
    var bar = document.createElement("span"); bar.className = "hud-bar";
    var fill = document.createElement("i"); fill.style.width = Math.round(100 * (g.xp % PER_LEVEL) / PER_LEVEL) + "%";
    bar.appendChild(fill); xp.appendChild(bar);
    xp.appendChild(document.createTextNode(" " + (g.xp % PER_LEVEL) + "/" + PER_LEVEL));
    pill("Серия ×" + g.streak, "hud-streak");
    if (m) {
      var st = {};
      try { st = JSON.parse(window.localStorage.getItem("practice-html-settings") || "{}"); } catch (e) { st = {}; }
      var all = st.track && m.graded[st.track] ? m.graded[st.track]
        : [].concat.apply([], Object.keys(m.graded).map(function (k) { return m.graded[k]; }));
      pill("★ " + all.filter(function (t) { return g.awarded[t.file]; }).length + " / " + all.length);
      if (THEME === "knight") {
        var d = dragonState(), bar = "";
        for (var i = 0; i < d.total; i++) bar += i < d.left ? "■" : "□";
        pill(d.left ? "Дракон " + bar + " " + d.left + "/" + d.total : "Дракон повержен", "hud-dragon");
      }
    }
  }

  function solvedTasks() {
    var p = {};
    p = (progressCodec.get("practice-html-progress", {}) || {}).tasks || {};
    return p;
  }

  /* ---------------- сцена ---------------- */
  var scenes = [];

  function Scene(block, index, count, isFinal) {
    this.block = block; this.index = index; this.count = count; this.isFinal = isFinal;
    this.file = block.getAttribute("data-file");
    this.kind = isFinal ? "portal" : THEME === "knight" ? "monster" : ["blob", "wall", "pit"][index % 3];
    this.mon = pageMonster();
    this.letter = LETTERS[index % 4];
    this.wrap = document.createElement("div");
    this.wrap.className = "game-scene";
    this.wrap.setAttribute("aria-hidden", "true");
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    this.canvas.width = W; this.canvas.height = H;
    this.hud = document.createElement("div");
    this.hud.className = "game-hud";
    this.caption = document.createElement("div");
    this.caption.className = "game-caption";
    this.wrap.appendChild(this.canvas); this.wrap.appendChild(this.hud); this.wrap.appendChild(this.caption);
    var bar = block.querySelector(".checker-bar");
    if (bar && bar.nextSibling && bar.nextSibling.parentNode === block) block.insertBefore(this.wrap, bar.nextSibling); else block.appendChild(this.wrap);
    if (THEME === "knight" && this.mon === "dragon" && block.closest(".task-exercise")) {
      this.loopBox = document.createElement("div"); this.loopBox.className = "game-loop";
      this.wrap.parentNode.insertBefore(this.loopBox, this.wrap.nextSibling); loopPanel(this);
    }
    this.ctx = this.canvas.getContext("2d");
    this.t = 0; this.visible = false; this.entered = false;
    this.obstX = 168; /* кратно 8: яма совпадает с плитками земли */
    this.reset(solvedTasks()[this.file] || state.done[this.file]);
    this.updateHud();
  }

  Scene.prototype.reset = function (solved) {
    this.mode = solved ? "done" : "idle";
    this.hx = solved ? 286 : 22; this.hy = GROUND - 16; this.vy = 0; this.vx = 0;
    this.coin = !solved && THEME !== "knight"; this.blink = 0; this.pose = "stand"; this.fx = [];
    this.dead = !!solved; this.struck = false; this.strikeT = 0; this.lunge = 0;
    if (solved && this.finale()) this.hx = 214;
    this.caption.textContent = solved ? (this.isFinal ? "Уровень пройден" : "Участок пройден") : "Задача " + (this.index + 1) + ": решите, чтобы пройти участок";
  };

  /* финал темы «Рыцарь»: сцена с драконом, здоровье дракона 0 */
  Scene.prototype.finale = function () { return THEME === "knight" && this.mon === "dragon" && !dragonState().left; };

  Scene.prototype.updateHud = function () {
    var s = solvedTasks(), n = 0;
    scenes.forEach(function (sc) { if (s[sc.file]) n++; });
    this.hud.innerHTML = "";
    var a = document.createElement("span"); a.textContent = "Участок " + (this.index + 1) + "/" + this.count;
    var g = loadG();
    var b = document.createElement("span"); b.textContent = "Серия ×" + g.streak;
    var c = document.createElement("span"); c.textContent = (THEME === "knight" ? "Побед " : "ДНК ") + n + "/" + this.count;
    this.hud.appendChild(a); this.hud.appendChild(b); this.hud.appendChild(c);
  };

  Scene.prototype.start = function () {
    this.mode = "wait"; this.caption.textContent = "Проверка…";
  };

  Scene.prototype.result = function (d) {
    if (this.loopBox && (d.level || "exercise") === "exercise") { addLoopRow(d.solved); scenes.forEach(function (s) { if (s.loopBox) loopPanel(s); }); }
    if (d.solved) {
      this.mode = "win"; this.vx = 1.7; this.pose = "run1";
      this.caption.textContent = this.isFinal ? "Вперед, к порталу!" : "Верно! Вперед";
      state.done[this.file] = true; saveState(state);
    } else {
      this.mode = "fail"; this.vx = 1.5; this.pose = "run1";
      this.failInfo = d;
      this.caption.textContent = "Пройдено тестов: " + d.passed + " из " + d.total;
    }
    if (reduced) this.finish(d.solved);
  };

  Scene.prototype.finish = function (win) {
    if (win) {
      this.mode = "done"; this.hx = this.finale() ? 214 : 286; this.hy = GROUND - 16; this.coin = false; this.dead = true;
      this.caption.textContent = this.isFinal ? "Уровень пройден! Все задачи решены" :
        "Участок пройден. Дальше: задача " + (this.index + 2);
      if (!reduced) SFX.win();
    } else {
      var fi = this.failInfo || {};
      this.caption.textContent = (fi.warn ? "Почти! Результат верный, нужен другой прием. " :
        (fi.total ? "Ой! Пройдено тестов " + fi.passed + " из " + fi.total + ". " : "Ой! ")) + "Подсказки ниже";
      saveState(state);
      this.mode = "idle"; this.hx = 22; this.hy = GROUND - 16; this.vx = 0; this.vy = 0; this.blink = 60; this.struck = false;
      if (!reduced) SFX.fail();
    }
    scenes.forEach(function (s) { s.updateHud(); });
  };

  /* ---------- физика и сценарии ---------- */
  Scene.prototype.step = function () {
    this.t++;
    if (this.blink > 0) this.blink--;
    var runPose = (Math.floor(this.t / 6) % 2) ? "run1" : "run2";
    var onGround = this.hy >= GROUND - 16;

    if (!this.entered && this.visible && this.mode === "idle") {
      /* вход слева: герой приходит с предыдущего участка */
      this.entered = true; this.hx = -14; this.mode = "enter";
    }
    if (this.mode === "enter") {
      this.hx += 1.2; this.pose = runPose;
      if (this.hx >= 22) { this.hx = 22; this.mode = "idle"; }
    } else if (this.mode === "idle" || this.mode === "done") {
      this.pose = "stand";
    } else if (this.mode === "wait") {
      this.pose = runPose;
      if (this.t % 8 === 0) this.fx.push({ x: this.hx - 2, y: GROUND - 3, life: 14, kind: "dust" });
    } else if (this.kind === "monster" && (this.mode === "win" || this.mode === "fail")) {
      this.stepKnight(runPose);
    } else if (this.mode === "win" || this.mode === "fail") {
      this.hx += this.vx;
      var jumpAt = this.obstX - 30;
      var win = this.mode === "win";
      if (win && this.kind !== "portal" && onGround && this.vy === 0 && this.hx >= jumpAt && this.hx < this.obstX) {
        this.vy = -3.3; SFX.jump();
      }
      if (!win && this.kind === "pit" && onGround && this.vy === 0 && this.hx >= jumpAt && this.hx < this.obstX) {
        this.vy = -1.8; this.vx = 0.9;
      }
      if (this.vy !== 0 || !onGround) {
        this.vy += 0.18; this.hy += this.vy;
        var overPit = this.kind === "pit" && this.hx + 6 > this.obstX + 1 && this.hx + 6 < this.obstX + 31;
        if (this.hy >= GROUND - 16 && !(overPit && !win)) { this.hy = GROUND - 16; this.vy = 0; }
        this.pose = this.vy < 0 || this.hy < GROUND - 16 ? "jump" : runPose;
      } else {
        this.pose = runPose;
      }
      /* нуклеотид */
      if (win && this.coin && Math.abs(this.hx + 6 - (this.obstX + 10)) < 8 && this.hy < GROUND - 30) {
        this.coin = false; SFX.coin();
        for (var i = 0; i < 8; i++) this.fx.push({ x: this.obstX + 10, y: GROUND - 40, vx: Math.cos(i) * 1.2, vy: Math.sin(i) * 1.2, life: 20, kind: "spark" });
      }
      if (!win) {
        var hit = false;
        if (this.kind === "blob" && this.hx + 11 >= this.obstX + 2) hit = true;
        if (this.kind === "wall" && this.hx + 11 >= this.obstX) hit = true;
        if (this.kind === "portal" && this.hx + 11 >= this.obstX + 4) hit = true;
        if (this.kind === "pit" && this.hy > H + 8) hit = true;
        if (hit && this.mode === "fail") {
          this.mode = "hurt"; this.vx = -1.4; this.vy = this.kind === "pit" ? 0 : -2; this.pose = "hurt"; this.hurtT = 40;
          if (this.kind !== "pit") for (var k = 0; k < 5; k++) this.fx.push({ x: this.hx + 10, y: this.hy + 2, vx: Math.random() * 2 - 1, vy: -Math.random() * 1.5, life: 24, kind: "star" });
        }
      }
      if (win && this.hx > W + 16) {
        if (this.isFinal) { this.mode = "portal"; this.portalT = 0; this.hx = W + 20; }
        else this.finish(true);
      }
      if (win && this.isFinal && this.hx >= this.obstX + 8 && this.mode === "win") {
        this.mode = "portal"; this.portalT = 0;
      }
    } else if (this.mode === "hurt") {
      this.hurtT--;
      this.hx += this.vx; this.vy += 0.18; this.hy += this.vy;
      if (this.hy >= GROUND - 16 && this.kind !== "pit") { this.hy = GROUND - 16; this.vy = 0; this.vx *= 0.8; }
      if (this.hurtT <= 0) this.finish(false);
    } else if (this.mode === "portal") {
      this.portalT++;
      if (this.portalT % 6 === 0) this.fx.push({ x: this.obstX + 6 + Math.random() * 12, y: GROUND - 30, vx: Math.random() * 2 - 1, vy: -1.5 - Math.random(), life: 40, kind: "spark" });
      if (this.portalT === 50) { for (var q = 0; q < 24; q++) this.fx.push({ x: W / 2, y: 30, vx: Math.cos(q) * 2.2, vy: Math.sin(q) * 2.2 - 1, life: 50, kind: "spark" }); }
      if (this.portalT > 80) this.finish(true);
    }
    this.fx = this.fx.filter(function (f) {
      f.life--; if (f.vx !== undefined) { f.x += f.vx; f.y += f.vy; f.vy += 0.05; }
      return f.life > 0;
    });
  };

  /* рыцарь подходит к монстру: верно, удар мечом и путь дальше; неверно, монстр отбрасывает */
  Scene.prototype.stepKnight = function (runPose) {
    var stop = this.obstX - 26;
    if (this.mode === "fail") {
      if (this.hx < stop) { this.hx += this.vx; this.pose = runPose; return; }
      this.mode = "hurt"; this.vx = -1.4; this.vy = -2; this.pose = "hurt"; this.hurtT = 40; this.lunge = 18;
      for (var k = 0; k < 5; k++) this.fx.push({ x: this.hx + 12, y: this.hy + 2, vx: Math.random() * 2 - 1, vy: -Math.random() * 1.5, life: 24, kind: "star" });
      return;
    }
    if (!this.dead) {
      if (this.hx < stop) { this.hx += this.vx; this.pose = runPose; return; }
      if (!this.struck) { this.struck = true; this.strikeT = 20; SFX.jump(); }
      this.pose = "strike";
      if (--this.strikeT === 10) {
        this.dead = true; SFX.coin();
        for (var i = 0; i < 12; i++) this.fx.push({ x: this.obstX + 8, y: GROUND - 14, vx: Math.cos(i) * 1.4, vy: Math.sin(i) * 1.4 - 0.6, life: 24, kind: "spark" });
      }
      return;
    }
    if (this.strikeT > 0) { this.strikeT--; this.pose = "strike"; return; }
    this.hx += this.vx; this.pose = runPose;
    if (this.hx > W + 16 || (this.finale() && this.hx >= 214)) this.finish(true);
  };

  /* ---------- отрисовка ---------- */
  Scene.prototype.draw = function () {
    var c = this.ctx, night = window.practiceTheme && window.practiceTheme() === "dark";
    var off = this.index * 180; /* фон продолжается с предыдущего участка */
    var sky = c.createLinearGradient(0, 0, 0, GROUND);
    var knight = THEME === "knight";
    sky.addColorStop(0, night ? "#141633" : knight ? "#C9A6D8" : "#6ECFF0");
    sky.addColorStop(1, night ? "#2A2E5C" : knight ? "#F7C59A" : "#CFF3FF");
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    if (night) {
      c.fillStyle = "#F4F1DE";
      for (var s = 0; s < 40; s++) {
        var sx = ((s * 97 + off * 0.1) % W + W) % W, sy = (s * 37) % (GROUND - 30);
        if ((s + Math.floor(this.t / 20)) % 7) c.fillRect(Math.round(sx), sy, 1, 1);
      }
      var MOON = ["..XXXXX..", ".XXXXXXX.", "XXXXXX...", "XXXXX....", "XXXXX....", "XXXXX....", "XXXXXX...", ".XXXXXXX.", "..XXXXX.."];
      c.fillStyle = "#F4F1DE";
      for (var my = 0; my < MOON.length; my++) for (var mx = 0; mx < 9; mx++) if (MOON[my][mx] === "X") c.fillRect(258 + mx, 8 + my, 1, 1);
    } else {
      for (var k = 0; k < 4; k++) {
        var cx = ((k * 110 - off * 0.2 - this.t * 0.08) % (W + 60) + W + 60) % (W + 60) - 40, cy = 8 + (k % 2) * 10;
        c.fillStyle = "#FFFFFF";
        c.fillRect(Math.round(cx), cy + 3, 26, 6); c.fillRect(Math.round(cx) + 5, cy, 14, 4);
      }
    }
    /* тема «Рыцарь»: замки на горизонте и дракон в небе, пока он жив */
    if (knight) {
      c.fillStyle = night ? "#2B2A4A" : "#8E7BA8";
      for (var ci = 0; ci < 3; ci++) {
        var tx = ((ci * 130 + 40 - off * 0.25) % (W + 120) + W + 120) % (W + 120) - 60;
        c.fillRect(tx, GROUND - 40, 16, 40); for (var cb = 0; cb < 3; cb++) c.fillRect(tx - 2 + cb * 7, GROUND - 44, 4, 4);
      }
      if (this.mon !== "dragon" && dragonState().left) drawK(c, KSPR.dragon, 210 + Math.round(Math.sin(this.t / 70 + this.index) * 40), 12 + Math.round(Math.sin(this.t / 23) * 2), false, 1);
    }
    /* дальние и ближние холмы */
    this.hills(c, off * 0.35, GROUND - 22, 34, night ? "#23264D" : "#8FD98C", 0.045);
    this.hills(c, off * 0.6, GROUND - 10, 20, night ? "#1C3A2A" : "#4DB45A", 0.07);
    /* земля */
    var pitX = this.kind === "pit" ? this.obstX : -999;
    for (var x = 0; x < W; x += 8) {
      if (x + 8 > pitX && x < pitX + 32) continue;
      var shift = Math.floor((off + x) / 8) % 2;
      c.fillStyle = night ? "#2FA866" : "#39B54A"; c.fillRect(x, GROUND, 8, 3);
      c.fillStyle = night ? "#5A3B22" : "#8B5A2B"; c.fillRect(x, GROUND + 3, 8, H - GROUND - 3);
      c.fillStyle = night ? "#46301C" : "#6E4520";
      c.fillRect(x + (shift ? 1 : 5), GROUND + 7, 2, 2); c.fillRect(x + (shift ? 5 : 2), GROUND + 12, 2, 2);
    }
    if (this.kind === "pit") {
      c.fillStyle = "#0B0C1A"; c.fillRect(pitX, GROUND, 32, H - GROUND);
      c.fillStyle = night ? "#46301C" : "#6E4520"; c.fillRect(pitX, GROUND, 2, H - GROUND); c.fillRect(pitX + 30, GROUND, 2, H - GROUND);
    }
    /* препятствие */
    if (this.kind === "monster") {
      if (this.finale() && (this.mode === "done" || this.mode === "idle")) {
        drawTower(c, 270, GROUND); drawK(c, KSPR.princess, 248, GROUND - 21, false, 1);
        if (this.t % 40 === 0) this.fx.push({ x: 254, y: GROUND - 26, vx: 0, vy: -0.6, life: 30, kind: "spark" });
      } else if (!this.dead || (this.struck && this.strikeT > 10)) {
        var lx = this.lunge > 0 ? -Math.min(12, this.lunge) : 0;
        if (this.lunge > 0) this.lunge--;
        drawMonster(c, this.mon, this.obstX + lx, GROUND, this.t, this.struck && this.strikeT % 4 < 2 ? "#FFFFFF" : null);
        if (this.mon === "dragon" && this.lunge > 0) {
          for (var fi = 0; fi < 60; fi += 3) { c.fillStyle = fi % 2 ? PAL.y : PAL.o; c.fillRect(this.obstX + lx - 8 - fi, GROUND - 16 + Math.round(Math.sin((this.t + fi) / 3)), 3 + fi / 12, 3 + fi / 12); }
        }
      }
    } else if (this.kind === "blob") {
      var bx = this.obstX + Math.round(Math.sin(this.t / 18) * 6);
      drawSprite(c, BLOB[Math.floor(this.t / 14) % 2], bx, GROUND - 9);
    } else if (this.kind === "wall") {
      for (var r = 0; r < 3; r++) for (var q = 0; q < 2; q++) this.tile(c, this.obstX + q * 8, GROUND - 8 - r * 8, night);
    } else if (this.kind === "portal") {
      var glow = this.mode === "portal" || this.mode === "done";
      if (glow) { c.fillStyle = "rgba(200,162,255," + (0.25 + 0.2 * Math.sin(this.t / 5)) + ")"; c.fillRect(this.obstX - 6, GROUND - 34, 26, 34); }
      drawSprite(c, TUBE, this.obstX, GROUND - 14 - 2);
      drawSprite(c, TUBE, this.obstX + 2, GROUND - 30);
    }
    /* нуклеотид */
    if (this.coin && this.kind !== "portal") this.nucleotide(c, this.obstX + 6, GROUND - 44 + Math.round(Math.sin(this.t / 10) * 2));
    /* указатель выхода */
    if (this.mode === "done" && !this.isFinal && !this.finale()) {
      c.fillStyle = "#8B5A2B"; c.fillRect(W - 14, GROUND - 16, 2, 16);
      c.fillStyle = "#F2C230"; c.fillRect(W - 22, GROUND - 20, 16, 7);
      c.fillStyle = "#1A1C2C"; c.fillRect(W - 19, GROUND - 17, 8, 1); c.fillRect(W - 13, GROUND - 18, 1, 3); c.fillRect(W - 12, GROUND - 17, 1, 1);
    }
    /* герой */
    var visibleHero = this.blink % 6 < 3 && this.hx > -16 && this.hx < W + 16 && this.hy < H &&
      !(this.mode === "portal" && this.portalT > 8) && !(this.isFinal && this.mode === "done");
    if (visibleHero && knight) drawK(c, KSPR["knight_" + this.pose] || KSPR.knight_stand, this.hx - 2, this.hy - 3, this.vx < 0 && this.mode === "hurt");
    else if (visibleHero) drawSprite(c, HERO[this.pose] || HERO.stand, this.hx, this.hy, this.vx < 0 && this.mode === "hurt");
    /* эффекты */
    this.fx.forEach(function (f) {
      if (f.kind === "dust") { c.fillStyle = "#E8E1C8"; c.fillRect(Math.round(f.x - (14 - f.life) / 2), f.y - Math.floor((14 - f.life) / 5), 2, 2); }
      if (f.kind === "spark") { c.fillStyle = f.life % 4 < 2 ? "#F2C230" : "#FFFFFF"; c.fillRect(Math.round(f.x), Math.round(f.y), 2, 2); }
      if (f.kind === "star") { c.fillStyle = "#F2C230"; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 3); c.fillRect(Math.round(f.x) - 1, Math.round(f.y) + 1, 3, 1); }
    });
  };

  Scene.prototype.hills = function (c, off, base, amp, color, freq) {
    c.fillStyle = color;
    for (var x = 0; x < W; x += 2) {
      var h = Math.round((Math.sin((x + off) * freq) * 0.5 + 0.5) * amp * 0.6 + amp * 0.4);
      c.fillRect(x, base - h + 12, 2, h);
    }
  };
  Scene.prototype.tile = function (c, x, y, night) {
    c.fillStyle = PAL.K; c.fillRect(x, y, 8, 8);
    c.fillStyle = night ? "#6C7AA8" : "#9AA5C8"; c.fillRect(x + 1, y + 1, 6, 6);
    c.fillStyle = night ? "#8C9AC8" : "#C9D0E8"; c.fillRect(x + 1, y + 1, 6, 1); c.fillRect(x + 1, y + 1, 1, 6);
    c.fillStyle = PAL.K; c.fillRect(x + 2, y + 2, 1, 1); c.fillRect(x + 5, y + 5, 1, 1);
  };
  Scene.prototype.nucleotide = function (c, x, y) {
    /* шестиугольник с буквой: собственный значок */
    c.fillStyle = PAL.K; c.fillRect(x + 2, y - 1, 6, 12); c.fillRect(x, y + 1, 10, 8); c.fillRect(x - 1, y + 3, 12, 4);
    c.fillStyle = PAL.y; c.fillRect(x + 2, y, 6, 10); c.fillRect(x + 1, y + 2, 8, 6); c.fillRect(x, y + 4, 10, 2);
    c.fillStyle = PAL.o; c.fillRect(x + 7, y + 2, 1, 6);
    var g = GLYPH[this.letter];
    c.fillStyle = PAL.K;
    for (var j = 0; j < 5; j++) for (var i = 0; i < 3; i++) if (g[j][i] === "1") c.fillRect(x + 3 + i, y + 2 + j, 1, 1);
  };


  /* ---------------- финальная игра практики (версия 72) ----------------
     Платформер на странице обзора, только в игровом режиме. Открывается, когда решены все
     упражнения своего уровня. Этапы это тематические страницы практики по порядку, в конце босс
     (в теме «Рыцарь» дракон). Здоровье: от 2 до 5 сердец на старте по доле упражнений, решенных
     с первой попытки; после этапа +1 сердце, излишек в щит (один); сердца кончились: этап заново
     с полным здоровьем. Кто дошел до босса, ни разу не потеряв сердце, получает значок и двойной удар.
     Прогресс игры не влияет на оценку. */
  var ARC = { MAX: 5, W: 320, H: 180, G: 160 };
  function practiceDone() {
    var m = window.PRACTICE_MANIFEST;
    if (!m || !m.graded) return null;
    var s = solvedTasks(), g = loadG(), tr = trackNow(), groups;
    if (tr && m.graded[tr]) groups = m.graded[tr].map(function (t) { return [t.file]; });
    else {
      var by = {};
      (m.exercises || []).forEach(function (t) { var k = t.page + "#" + (t.group || t.file); (by[k] = by[k] || []).push(t.file); });
      groups = Object.keys(by).map(function (k) { return by[k]; });
    }
    var done = 0, first = 0;
    groups.forEach(function (fs) {
      var sv = fs.filter(function (f) { return s[f]; });
      if (sv.length) { done++; if (sv.some(function (f) { return g.awarded[f] && g.awarded[f].first; })) first++; }
    });
    return { done: done, total: groups.length, first: first };
  }
  function arcStages() {
    var m = window.PRACTICE_MANIFEST || { pages: [] };
    return m.pages.filter(function (p) { return p.kind !== "overview"; }).map(function (p) { return p.number + " " + (p.name || p.title); });
  }
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function makeLevel(i) {
    var r = rng(i * 7919 + 13), len = Math.min(1300, 900 + i * 50), G = ARC.G, x = 0, lv = { len: len, grounds: [], plats: [], foes: [], coins: [] };
    while (x < len) {
      var seg = Math.round(150 + r() * 130), a = x, b = Math.min(len + 60, x + seg);
      lv.grounds.push([a, b]);
      if (a > 0) {
        if (r() < 0.75) { var pw = Math.round(36 + r() * 22), px = Math.round(a + 20 + r() * Math.max(10, seg - pw - 40)), py = Math.round(G - 36 - r() * 16);
          lv.plats.push({ x: px, y: py, w: pw }); for (var c = 0; c < 3; c++) lv.coins.push({ x: px + 6 + c * (pw - 12) / 2, y: py - 12, on: true }); }
        var nf = 1 + (i > 3 && r() < 0.5 ? 1 : 0);
        for (var f = 0; f < nf; f++) { var fa = a + 18, fb = b - 26; if (fb - fa > 30) lv.foes.push({ a: fa, b: fb, x: fa + r() * (fb - fa), d: r() < 0.5 ? -1 : 1, fly: r() < 0.25, alive: true, ph: r() * 6 }); }
      }
      x = b;
      if (x < len - 100) { var gap = Math.round(26 + r() * Math.min(20, 8 + i * 2)); lv.coins.push({ x: x + gap / 2 - 3, y: G - 46, on: true }); x += gap; }
    }
    return lv;
  }
  var ARC_ENEMY = ["slime", "skeleton", "ghost", "goblin", "bat", "goblin", "slime", "skeleton"];

  function Arcade() {
    var self = this;
    this.ov = document.createElement("div"); this.ov.className = "arc-overlay"; this.ov.setAttribute("role", "dialog"); this.ov.setAttribute("aria-label", "Финальная игра");
    this.ov.innerHTML = '<div class="arc-box"><div class="arc-top"><span class="arc-stage"></span><span class="arc-hp"></span><button type="button" class="arc-close">Закрыть</button></div>' +
      '<canvas class="arc-canvas" width="' + ARC.W + '" height="' + ARC.H + '" tabindex="0" aria-label="Игровое поле: стрелки и пробел"></canvas>' +
      '<p class="arc-msg" aria-live="polite"></p><div class="arc-pad"><button type="button" data-k="left" aria-label="Влево">◀</button><button type="button" data-k="right" aria-label="Вправо">▶</button><button type="button" data-k="jump" aria-label="Прыжок">▲</button></div></div>';
    document.body.appendChild(this.ov);
    this.cv = this.ov.querySelector("canvas"); this.c = this.cv.getContext("2d"); this.c.imageSmoothingEnabled = false;
    this.keys = {};
    var map = { ArrowLeft: "left", ArrowRight: "right", " ": "jump", ArrowUp: "jump", a: "left", d: "right", w: "jump", "ф": "left", "в": "right", "ц": "jump" };
    this.onKey = function (e) {
      if (e.key === "Escape") { self.close(); return; }
      var k = map[e.key]; if (!k) return;
      self.keys[k] = e.type === "keydown"; e.preventDefault();
    };
    this.ov.querySelector(".arc-close").addEventListener("click", function () { self.close(); });
    Array.prototype.forEach.call(this.ov.querySelectorAll(".arc-pad button"), function (b) {
      var k = b.getAttribute("data-k");
      b.addEventListener("pointerdown", function (e) { self.keys[k] = true; e.preventDefault(); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, function () { self.keys[k] = false; }); });
    });
    this.stages = arcStages();
    var pr = practiceDone() || { first: 0, total: 1 };
    this.startHp = Math.max(2, Math.min(ARC.MAX, 2 + Math.round(3 * pr.first / Math.max(1, pr.total))));
    this.hp = this.startHp; this.shield = false; this.flawless = true; this.coins = 0; this.stage = 0;
    this.loadStage(0, true);
  }
  Arcade.prototype.open = function () {
    var self = this;
    this.ov.hidden = false; document.addEventListener("keydown", this.onKey); document.addEventListener("keyup", this.onKey);
    this.cv.focus(); this.running = true; this.last = 0;
    var tick = function (ts) {
      if (!self.running) return;
      var dt = Math.min(0.05, (ts - (self.last || ts)) / 1000); self.last = ts;
      self.step(dt); self.draw();
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };
  Arcade.prototype.close = function () {
    this.running = false; this.ov.hidden = true; this.keys = {};
    document.removeEventListener("keydown", this.onKey); document.removeEventListener("keyup", this.onKey);
  };
  Arcade.prototype.msg = function (t) { this.ov.querySelector(".arc-msg").textContent = t; };
  Arcade.prototype.hud = function () {
    var boss = this.stage >= this.stages.length;
    this.ov.querySelector(".arc-stage").textContent = boss ? "Босс" + (THEME === "knight" ? ": дракон" : "") :
      "Этап " + (this.stage + 1) + " из " + this.stages.length + " · " + this.stages[this.stage];
    var h = ""; for (var i = 0; i < ARC.MAX; i++) h += i < this.hp ? "♥" : "♡";
    this.ov.querySelector(".arc-hp").textContent = h + (this.shield ? " ◆" : "") + "  ● " + this.coins;
  };
  Arcade.prototype.loadStage = function (i, keepMsg) {
    this.stage = i; this.boss = i >= this.stages.length;
    this.lv = this.boss ? { len: ARC.W, grounds: [[-40, ARC.W + 40]], plats: [{ x: 40, y: 122, w: 48 }, { x: 232, y: 122, w: 48 }], foes: [], coins: [] } : makeLevel(i);
    this.x = 20; this.y = ARC.G - 16; this.vx = 0; this.vy = 0; this.inv = 0; this.cam = 0; this.safeX = 20; this.face = 1; this.won = false;
    this.bossHp = 3; this.bx = 240; this.bd = -1; this.bInv = 0; this.fire = []; this.fireT = 1.5; this.over = false;
    if (this.boss && this.flawless) { this.double = true; this.badge("scratchless", "Без единой царапины"); }
    if (!keepMsg) this.msg(this.boss ? (this.double ? "Ни одного потерянного сердца: удар по боссу двойной!" : "Босс! Прыгайте ему на голову.") : "");
    this.hud();
  };
  Arcade.prototype.badge = function (key, name) {
    var g = loadG();
    if (!g.badges[key]) { g.badges[key] = true; saveG(g); toast("Значок: " + name); }
  };
  Arcade.prototype.hurt = function () {
    if (this.inv > 0) return;
    this.inv = 1.2; this.vy = -150; this.vx = -this.face * 60;
    if (this.shield) { this.shield = false; this.hud(); return; }
    this.hp--; this.flawless = false;
    if (this.hp <= 0) { this.hp = ARC.MAX; this.shield = false; this.loadStage(this.stage, true); this.msg("Сердца кончились: этап заново, здоровье полное."); }
    this.hud();
  };
  Arcade.prototype.clearStage = function () {
    if (this.hp < ARC.MAX) { this.hp++; this.msg("Этап пройден: +1 сердце."); }
    else if (!this.shield) { this.shield = true; this.msg("Этап пройден. Сердца полные: получен щит, он примет один удар."); }
    else this.msg("Этап пройден. Сердца полные, щит уже есть.");
    this.loadStage(this.stage + 1, true);
    if (this.boss) this.msg(this.double ? "Ни одного потерянного сердца: удар по боссу двойной!" : "Босс! Прыгайте ему на голову.");
  };
  Arcade.prototype.onGround = function (x) { return this.lv.grounds.some(function (g) { return x + 10 > g[0] && x + 2 < g[1]; }); };
  Arcade.prototype.step = function (dt) {
    if (this.over) return;
    var G = ARC.G, k = this.keys, lv = this.lv, self = this;
    var ax = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    if (ax) this.face = ax;
    if (this.inv < 0.9) this.vx = ax * 90;
    this.vy += 640 * dt;
    var ny = this.y + this.vy * dt, grounded = false;
    if (this.vy >= 0) {
      if (this.onGround(this.x) && this.y + 16 <= G + 1 && ny + 16 >= G) { ny = G - 16; this.vy = 0; grounded = true; this.safeX = this.x; }
      lv.plats.forEach(function (p) { if (self.x + 10 > p.x && self.x + 2 < p.x + p.w && self.y + 16 <= p.y + 1 && ny + 16 >= p.y) { ny = p.y - 16; self.vy = 0; grounded = true; } });
    }
    this.y = ny; this.x = Math.max(0, Math.min(lv.len + (this.boss ? -12 : 40), this.x + this.vx * dt));
    if (k.jump && grounded) { this.vy = -250; SFX.jump(); }
    if (this.inv > 0) this.inv -= dt;
    if (this.y > ARC.H + 20) { this.x = Math.max(0, this.safeX - 24); this.y = G - 40; this.vy = 0; this.hurt(); }
    lv.foes.forEach(function (f) {
      if (!f.alive) return;
      f.x += f.d * 26 * dt; if (f.x < f.a || f.x > f.b) f.d *= -1;
      f.ph += dt * 3;
      var fy = f.fly ? G - 34 + Math.sin(f.ph) * 8 : G - 12;
      if (self.x + 11 > f.x && self.x + 1 < f.x + 13 && self.y + 16 > fy && self.y < fy + 12) {
        if (self.vy > 0 && self.y + 16 < fy + 7) { f.alive = false; self.vy = -180; SFX.coin(); }
        else self.hurt();
      }
    });
    lv.coins.forEach(function (c) { if (c.on && Math.abs(self.x + 6 - c.x - 3) < 9 && Math.abs(self.y + 8 - c.y - 3) < 12) { c.on = false; self.coins++; SFX.coin(); self.hud(); } });
    if (this.boss) this.stepBoss(dt);
    else if (this.x > lv.len - 30) this.clearStage();
    this.cam = Math.max(0, Math.min(lv.len - ARC.W + (this.boss ? 0 : 40), this.x - 130));
  };
  Arcade.prototype.stepBoss = function (dt) {
    var G = ARC.G, self = this, bw = THEME === "knight" ? 38 : 36, bh = THEME === "knight" ? 30 : 27;
    if (this.bossHp <= 0) return;
    this.bx += this.bd * 40 * dt; if (this.bx < 120 || this.bx > ARC.W - bw - 8) this.bd *= -1;
    if (this.bInv > 0) this.bInv -= dt;
    this.fireT -= dt;
    if (this.fireT <= 0) { this.fireT = 2.2; this.fire.push({ x: this.bx, y: G - 18, vx: this.x < this.bx ? -110 : 110 }); }
    this.fire = this.fire.filter(function (f) {
      f.x += f.vx * dt;
      if (Math.abs(self.x + 6 - f.x) < 9 && Math.abs(self.y + 10 - f.y) < 9) { self.hurt(); return false; }
      return f.x > -20 && f.x < ARC.W + 20;
    });
    var by = G - bh;
    if (this.x + 11 > this.bx && this.x + 1 < this.bx + bw && this.y + 16 > by && this.y < G) {
      if (this.vy > 0 && this.y + 16 < by + 10 && this.bInv <= 0) {
        this.bossHp -= this.double ? 2 : 1; this.double = false; this.bInv = 1; this.vy = -230; SFX.coin();
        if (this.bossHp <= 0) {
          this.over = true; SFX.win();
          this.msg(THEME === "knight" ? "Дракон повержен, принцесса свободна! Практика пройдена." : "Босс повержен! Практика пройдена.");
          this.badge("arcade", "Финальная игра пройдена");
        }
      } else this.hurt();
    }
  };
  Arcade.prototype.draw = function () {
    var c = this.c, G = ARC.G, cam = Math.round(this.cam), t = (this.last || 0) / 16, knight = THEME === "knight", lv = this.lv;
    var sky = c.createLinearGradient(0, 0, 0, G); sky.addColorStop(0, knight ? "#C9A6D8" : "#6ECFF0"); sky.addColorStop(1, knight ? "#F7C59A" : "#CFF3FF");
    c.fillStyle = sky; c.fillRect(0, 0, ARC.W, ARC.H);
    var hue = ["#8FD98C", "#7CC6E8", "#C9A6E8", "#E8C27C", "#8FD9C4", "#E89B8F", "#B4D98C", "#9FA8E8"][this.stage % 8];
    c.fillStyle = hue;
    for (var x = 0; x < ARC.W; x += 2) c.fillRect(x, G - 30 - Math.round((Math.sin((x + cam * 0.4) * 0.04) * 0.5 + 0.5) * 22), 2, 40);
    lv.grounds.forEach(function (g) {
      var a = g[0] - cam, b = g[1] - cam; if (b < 0 || a > ARC.W) return;
      c.fillStyle = PAL.K; c.fillRect(a - 1, G, b - a + 2, ARC.H - G);
      c.fillStyle = "#39B54A"; c.fillRect(a, G, b - a, 3); c.fillStyle = "#8B5A2B"; c.fillRect(a, G + 3, b - a, ARC.H - G - 3);
    });
    lv.plats.forEach(function (p) { c.fillStyle = PAL.K; c.fillRect(p.x - cam - 1, p.y - 1, p.w + 2, 7); c.fillStyle = "#8B5A2B"; c.fillRect(p.x - cam, p.y, p.w, 5); c.fillStyle = "#39B54A"; c.fillRect(p.x - cam, p.y, p.w, 2); });
    lv.coins.forEach(function (o) { if (!o.on) return; var cx = Math.round(o.x - cam), cy = Math.round(o.y + Math.sin(t / 10 + o.x) * 2);
      c.fillStyle = PAL.K; c.fillRect(cx - 1, cy - 1, 9, 9); c.fillStyle = PAL.y; c.fillRect(cx, cy, 7, 7); c.fillStyle = PAL.o; c.fillRect(cx + 5, cy + 1, 1, 5); });
    var self = this;
    lv.foes.forEach(function (f, i) {
      if (!f.alive) return;
      var fy = f.fly ? G - 34 + Math.sin(f.ph) * 8 : G - 12, fx = f.x - cam;
      if (knight) { var kind = f.fly ? "bat" : ARC_ENEMY[self.stage % ARC_ENEMY.length]; var sp = KSPR[kind] || KSPR.slime; drawK(c, sp, fx - 1, fy + 12 - sp.length, f.d > 0); }
      else drawSprite(c, BLOB[Math.floor(t / 12) % 2], fx, fy + 3, f.d > 0);
    });
    if (!this.boss) {
      var fx2 = lv.len - 24 - cam; c.fillStyle = PAL.K; c.fillRect(fx2, G - 40, 2, 40); c.fillStyle = knight ? "#E5484D" : PAL.y; c.fillRect(fx2 + 2, G - 40, 14, 9);
    } else {
      if (this.bossHp > 0 || (t % 8 < 4)) {
        var tint = this.bInv > 0 && t % 4 < 2 ? "#FFFFFF" : null;
        if (knight) drawK(c, KSPR.dragon, this.bx - cam, G - 30, this.bd > 0, 1, tint);
        else drawK(c, BLOB[Math.floor(t / 12) % 2], this.bx - cam, G - 27, false, 3, tint, PAL);
      }
      this.fire.forEach(function (f) { c.fillStyle = PAL.o; c.fillRect(f.x - cam - 3, f.y - 3, 7, 7); c.fillStyle = PAL.y; c.fillRect(f.x - cam - 1, f.y - 1, 3, 3); });
      c.fillStyle = PAL.K; c.fillRect(ARC.W / 2 - 31, 6, 62, 8);
      for (var hpi = 0; hpi < 3; hpi++) { c.fillStyle = hpi < this.bossHp ? "#D62839" : "#3A2A3A"; c.fillRect(ARC.W / 2 - 30 + hpi * 20, 7, 19, 6); }
      if (this.over && knight) { drawK(c, KSPR.princess, 290, G - 21, true, 1); }
    }
    if (!(this.inv > 0 && t % 6 < 3)) {
      var air = this.vy !== 0, pose = air ? "jump" : this.vx ? (Math.floor(t / 6) % 2 ? "run1" : "run2") : "stand";
      if (knight) drawK(c, KSPR["knight_" + pose], this.x - cam - 2, this.y - 3, this.face < 0);
      else drawSprite(c, HERO[pose], this.x - cam, this.y, this.face < 0);
    }
  };

  /* вход в финальную игру на странице обзора */
  var arcade = null;
  function arcadeEntry() {
    if (!/t\d+_00\.html$/.test(PAGE)) return;
    var main = document.querySelector("main.content");
    if (!main || !window.PRACTICE_MANIFEST) return;
    var box = document.getElementById("arcade-entry");
    if (!box) {
      box = document.createElement("section"); box.id = "arcade-entry"; box.className = "arc-entry";
      var goals = main.querySelector("section.goals");
      if (goals && goals.nextSibling) main.insertBefore(box, goals.nextSibling); else main.insertBefore(box, main.firstChild);
    }
    var pr = practiceDone() || { done: 0, total: 0 }, open = pr.total > 0 && pr.done === pr.total;
    box.innerHTML = "";
    var h = document.createElement("h2"); h.textContent = "Финальная игра"; box.appendChild(h);
    var p = document.createElement("p");
    p.textContent = open ? "Все упражнения вашего уровня решены. Пройдите все страницы практики как уровни игры" +
      (THEME === "knight" ? " и победите дракона." : " и победите босса.") + " Сердец на старте: чем больше упражнений решено с первой попытки, тем больше. На оценку игра не влияет."
      : "Откроется, когда будут решены все упражнения вашего уровня: решено " + pr.done + " из " + pr.total + ".";
    box.appendChild(p);
    var b = document.createElement("button"); b.type = "button"; b.className = "arc-play"; b.textContent = open ? "Играть" : "Пока закрыто"; b.disabled = !open;
    b.addEventListener("click", function () { if (arcade) { arcade.ov.remove(); } arcade = THEME === "dungeon" && typeof DungeonArt !== "undefined" ? new DArcade() : new Arcade(); arcade.open(); });
    box.appendChild(b);
  }

  /* ---------------- тема «Подземелье» (версия 120, практика 6) ----------------
     Включается game_theme: "dungeon" (data-game-theme у <main> обзора). Одно упражнение = одна комната:
     зал нарисован в DungeonArt (изометрия), герой подходит к монстрам, затем к сундуку.
     Исход берется из checker:result (passed, total): все тесты = бой, сундук и лут в сумку;
     1–2 непройденных (и хоть один пройден) = мимик и надгробие, исправление возвращает героя к сундуку;
     больше = монстр отбивает удар, герой отступает. Этаж зависит от номера страницы (01–02 → 1 …
     09 → 5), число монстров от варианта (базовый 1, средний 2, продвинутый 3), задача со звездочкой
     это тайная комната с кристальным сундуком, итоговая задача страницы 6.9 это бой со стражем таблицы.
     Сумка и состояние боя лежат в progressCodec (ключ practice-html-game, поля bag, given, boss). */
  var DG = {
    HERO: { f1: "keeper", f2: "ranger", f3: "alchemist", f4: "scribe", f5: "keeper" },
    MOB: { f1: "skeleton", f2: "ghost", f3: "slime", f4: "goblin", f5: "bat" },
    MOBNAME: { skeleton: ["Скелет-ключник", "Скелеты"], ghost: ["Призрак перебора", "Призраки"], slime: ["Слизень-двойник", "Слизни"], goblin: ["Гоблин-путаник", "Гоблины"], bat: ["Нетопырь-близнец", "Нетопыри"] },
    FLOORNAME: { f1: "Старое кладбище", f2: "Крипта с жаровней", f3: "Витражный зал", f4: "Пещера", f5: "Логово стража" },
    PARTY: [["keeper", "Ключница", "f1"], ["ranger", "Следопыт", "f2"], ["alchemist", "Алхимик", "f3"], ["scribe", "Рунный писец", "f4"]],
    SK: { hero: 1, foe: .93, boss: 1.05, chest: .84, item: .85, tomb: 1, portal: 1, spark: .9 },
    TIER: { basic: ["wood", ["coin", "key"]], medium: ["iron", ["coin", "key", "potion"]], advanced: ["gold", ["coin", "key", "potion", "gem"]], star: ["crystal", ["coin", "scroll", "gem"]] },
    USE: { coin: "монеты", key: "ключи", potion: "зелья", gem: "самоцветы", scroll: "свитки", crown: "корона" }
  };
  function dgFloor(n) { return n <= 2 ? "f1" : n <= 4 ? "f2" : n <= 6 ? "f3" : n <= 8 ? "f4" : "f5"; }
  function dgPageNo() { var m = /t\d+_(\d+)\.html/.exec(PAGE); return m ? +m[1] : 1; }
  function dgVariant(file) { var m = /_(basic|medium|advanced)(?:\.py)?$/.exec(file || ""); return m ? m[1] : "basic"; }
  function dgBag() { return loadG().bag || {}; }
  function dgBagAdd(list, file) {
    var g = loadG(); g.bag = g.bag || {}; g.given = g.given || {};
    if (g.given[file]) return false;
    g.given[file] = true; list.forEach(function (k) { g.bag[k] = (g.bag[k] || 0) + 1; }); saveG(g); return true;
  }
  /* этаж пройден, когда решены все упражнения его страниц своего уровня (без задач со звездочкой) */
  function dgFloorsDone() {
    var m = window.PRACTICE_MANIFEST, s = solvedTasks(), tr = trackNow(), res = {};
    if (!m || !m.graded) return res;
    var list = tr && m.graded[tr] ? m.graded[tr] : [].concat.apply([], Object.keys(m.graded).map(function (k) { return m.graded[k]; }));
    var by = {};
    list.forEach(function (t) {
      var mm = /t\d+_(\d+)_/.exec(t.file); if (!mm || /_star_/.test(t.file)) return;
      var f = dgFloor(+mm[1]); (by[f] = by[f] || []).push(t.file);
    });
    /* версия 121: без выбранного уровня упражнение засчитано, если решен любой его вариант */
    Object.keys(by).forEach(function (f) {
      if (tr) { res[f] = by[f].every(function (x) { return s[x]; }); return; }
      var ex = {};
      by[f].forEach(function (x) { var k = x.replace(/_(?:basic|medium|advanced)(?:\.py)?$/, ""); ex[k] = ex[k] || !!s[x]; });
      res[f] = Object.keys(ex).every(function (k) { return ex[k]; });
    });
    return res;
  }
  function dgSprite(name) {
    var sp = DungeonArt.sprite(name); if (!sp) return null;
    var cv = document.createElement("canvas"), k = DG.SK[sp.type] || 1;
    cv.className = "dg-spr"; cv.width = sp.w; cv.height = sp.h;
    cv.style.width = "calc(" + (sp.w * k) + " * var(--dg-px))"; cv.style.height = "calc(" + (sp.h * k) + " * var(--dg-px))";
    var c = cv.getContext("2d"); c.imageSmoothingEnabled = false; c.drawImage(sp.canvas, 0, 0);
    return cv;
  }
  function dgWait(ms) { return new Promise(function (r) { window.setTimeout(r, ms); }); }

  function DScene(block, index, count, isFinal) {
    var self = this;
    this.block = block; this.index = index; this.count = count; this.isFinal = isFinal;
    this.file = block.getAttribute("data-file");
    this.floor = dgFloor(dgPageNo());
    this.star = /_star_/.test(this.file);
    this.variant = dgVariant(this.file);
    this.tier = DG.TIER[this.star ? "star" : this.variant];
    this.nmob = this.star ? 1 : ({ basic: 1, medium: 2, advanced: 3 })[this.variant] || 1;
    this.mob = DG.MOB[this.floor];
    this.token = 0; this.slain = false; this.dead = false; this.visible = false; this.mode = "idle"; this.last = 0;
    this.wrap = document.createElement("div");
    this.wrap.className = "game-scene dg-scene" + (isFinal ? " dg-final" : ""); this.wrap.setAttribute("aria-hidden", "true");
    this.wrap.innerHTML = '<canvas class="dg-world" width="456" height="240"></canvas><div class="dg-banner"></div>' +
      '<div class="dg-actors"><div class="dg-grp"><div class="dg-actor dg-hero"></div></div><div class="dg-grp dg-mobs"></div>' +
      '<div class="dg-grp"><div class="dg-chestbox"><div class="dg-loot"></div><div class="dg-chest"></div></div></div></div>';
    this.world = this.wrap.querySelector(".dg-world"); this.bannerEl = this.wrap.querySelector(".dg-banner");
    this.hero = this.wrap.querySelector(".dg-hero"); this.mobs = this.wrap.querySelector(".dg-mobs");
    this.chestbox = this.wrap.querySelector(".dg-chestbox"); this.chest = this.wrap.querySelector(".dg-chest"); this.loot = this.wrap.querySelector(".dg-loot");
    this.foot = document.createElement("div"); this.foot.className = "dg-foot";
    this.caption = document.createElement("p"); this.caption.className = "dg-caption"; this.caption.setAttribute("aria-live", "off");
    this.potion = document.createElement("button"); this.potion.type = "button"; this.potion.className = "dg-potion"; this.potion.hidden = true;
    this.potion.textContent = "Выпить зелье";
    this.potion.addEventListener("click", function () { self.drink(); });
    this.foot.appendChild(this.caption); this.foot.appendChild(this.potion);
    var bar = block.querySelector(".checker-bar");
    var anchor = bar && bar.nextSibling && bar.nextSibling.parentNode === block ? bar.nextSibling : null;
    block.insertBefore(this.wrap, anchor); block.insertBefore(this.foot, this.wrap.nextSibling);
    this.fit();
    if ("ResizeObserver" in window) new ResizeObserver(function () { self.fit(); }).observe(this.wrap);
    this.paint(0);
    this.reset(solvedTasks()[this.file] || state.done[this.file]);
  }
  DScene.prototype.fit = function () { this.wrap.style.setProperty("--dg-px", (this.wrap.clientWidth / 456 * 1.52 || 1.5).toFixed(3) + "px"); };
  DScene.prototype.paint = function (t) { DungeonArt.world(this.world, this.isFinal ? "f5" : this.floor, t); };
  DScene.prototype.step = function () {};
  DScene.prototype.draw = function () {
    var now = window.performance.now();
    if (now - this.last < 110) return;
    this.last = now; this.paint(now / 1000);
  };
  DScene.prototype.say = function (text) { this.caption.textContent = text; };
  DScene.prototype.banner = function (text, bad) { this.bannerEl.textContent = text; this.bannerEl.className = "dg-banner on" + (bad ? " bad" : ""); };
  DScene.prototype.put = function (el, name) { el.innerHTML = ""; var c = dgSprite(name); if (c) el.appendChild(c); };
  DScene.prototype.tx = function (el, x, ms) {
    if (ms && !reduced) { el.classList.add("walk"); el.style.setProperty("--t", Math.round(ms) + "ms"); } else el.classList.remove("walk");
    el.style.transform = x ? "translateX(" + Math.round(x) + "px)" : "";
  };
  DScene.prototype.gap = function (el, target, cur) { return target.getBoundingClientRect().left - (el.getBoundingClientRect().right - cur); };
  DScene.prototype.px = function () { return parseFloat(window.getComputedStyle(this.wrap).getPropertyValue("--dg-px")) || 1.5; };
  DScene.prototype.spawn = function () {
    this.mobs.innerHTML = "";
    if (this.isFinal) {
      var b = document.createElement("div"); b.className = "dg-actor dg-boss"; this.put(b, "boss"); this.mobs.appendChild(b); return;
    }
    for (var i = 0; i < this.nmob; i++) { var d = document.createElement("div"); d.className = "dg-actor"; this.put(d, this.mob); this.mobs.appendChild(d); }
  };
  DScene.prototype.standUp = function () {
    this.dead = false; this.hero.className = "dg-actor dg-hero"; this.hero.style.transform = "";
    this.put(this.hero, DG.HERO[this.isFinal ? "f1" : this.floor]);
    this.chestbox.className = "dg-chestbox"; this.bannerEl.className = "dg-banner"; this.loot.innerHTML = "";
    if (this.isFinal) this.chest.innerHTML = ""; else this.put(this.chest, "chest_" + this.tier[0]);
    this.potion.hidden = true;
  };
  DScene.prototype.updateHud = function () {
    if (this.mode !== "idle") return;
    var bag = dgBag(), parts = Object.keys(bag).filter(function (k) { return bag[k] > 0 && DG.USE[k]; }).map(function (k) { return DG.USE[k] + " ×" + bag[k]; });
    this.say(this.isFinal ? "Страж таблицы ждет в логове. Решите задачу, чтобы вступить в бой." :
      "Этаж «" + DG.FLOORNAME[this.floor] + "»" + (this.star ? ", тайная комната." : ".") + " " + DG.MOBNAME[this.mob][1] + ": " + this.nmob + "." +
      (parts.length ? " Сумка: " + parts.join(", ") + "." : ""));
  };
  DScene.prototype.reset = function (solved) {
    this.token++; this.mode = solved ? "done" : "idle"; this.slain = !!solved;
    this.spawn(); this.standUp();
    if (solved) {
      var hasBoss = this.isFinal, g = loadG();
      [].forEach.call(this.mobs.children, function (m) { m.classList.add("dead"); });
      if (!this.isFinal) { this.put(this.chest, "chest_" + this.tier[0] + "_open"); this.chestbox.classList.add("open"); }
      else if (g.boss) this.put(this.chest, "portal");
      this.say(hasBoss && !g.boss ? "Страж устоял: пройдите остальные этажи, и он падет." : "Комната пройдена.");
    } else this.updateHud();
  };
  DScene.prototype.start = function () {
    this.token++; this.mode = "run"; this.say("Идет проверка…"); this.hero.classList.add("walk-in-place");
  };
  DScene.prototype.drink = function () {
    var g = loadG(); if (!this.dead || !(g.bag && g.bag.potion > 0)) return;
    g.bag.potion--; saveG(g); this.token++; this.mode = "idle"; this.standUp();
    this.say("Зелье выпито: герой снова на ногах и ждет новой проверки."); 
  };
  DScene.prototype.result = function (d) {
    var self = this, token = ++this.token, live = function () { return token === self.token; };
    var failed = Math.max(0, (d.total || 0) - (d.passed || 0)), ok = !!d.solved;
    var outcome = ok ? "win" : (!d.error && failed > 0 && failed <= 2 && (d.passed || 0) > 0 && !this.isFinal) ? "mimic" : "repel";
    this.hero.classList.remove("walk-in-place"); this.mode = "run";
    var done = function () { if (live()) self.mode = ok ? "done" : "idle"; };
    (this.isFinal ? this.finalFight(outcome, live) : this.fight(outcome, live)).then(done);
  };
  /* обычная комната: монстры, затем сундук */
  DScene.prototype.fight = async function (outcome, live) {
    var hero = this.hero, P = this.px(), hx = 0, i, e, d, t;
    if (this.dead || (this.slain && outcome === "repel")) { this.slain = false; this.spawn(); }
    if (this.dead) { this.standUp(); this.say("Новая попытка: герой снова у двери."); await dgWait(400); if (!live()) return; }
    if (this.slain === false && !this.mobs.children.length) this.spawn();
    this.standUp();
    if (outcome === "repel") {
      e = this.mobs.children[0]; d = this.gap(hero, e, 0) + P * 3; t = Math.max(320, d / .34);
      this.say("Герой идет на монстра."); this.tx(hero, d, t); await dgWait(reduced ? 0 : t + 60); if (!live()) return;
      this.tx(hero, d + P * 5); await dgWait(reduced ? 0 : 130); this.tx(e, P * 2); this.banner("Удар отбит!", true); await dgWait(reduced ? 0 : 220); if (!live()) return;
      this.tx(e, -P * 7); hero.classList.add("hurt"); this.tx(hero, d - P * 7); await dgWait(reduced ? 0 : 240); if (!live()) return;
      hero.classList.remove("hurt"); this.tx(e, 0); this.say("Герой отступает к двери."); this.tx(hero, 0, t); await dgWait(reduced ? 0 : t + 80); if (!live()) return;
      this.tx(hero, 0); this.say("Не пройдено больше двух тестов: монстры отбили удар, сундук закрыт. Исправьте решение и запустите проверку снова.");
      return;
    }
    if (!this.slain) {
      for (i = 0; i < this.mobs.children.length; i++) {
        e = this.mobs.children[i]; if (e.classList.contains("dead")) continue;
        d = this.gap(hero, e, hx) + P * 3; t = Math.max(320, (d - hx) / .34);
        this.say("Герой идет на монстра."); this.tx(hero, d, t); await dgWait(reduced ? 0 : t + 60); if (!live()) return; hx = d;
        this.tx(e, -P * 6); await dgWait(reduced ? 0 : 150); this.tx(hero, hx - P * 4); await dgWait(reduced ? 0 : 150); if (!live()) return;
        this.tx(e, 0); this.tx(hero, hx + P * 5); await dgWait(reduced ? 0 : 130); e.classList.add("hurt"); this.tx(e, P * 6); await dgWait(reduced ? 0 : 170); if (!live()) return;
        e.classList.remove("hurt"); e.classList.add("dead"); this.tx(hero, hx);
        this.say(DG.MOBNAME[this.mob][0] + " повержен (" + (i + 1) + " из " + this.mobs.children.length + ")."); await dgWait(reduced ? 0 : 420); if (!live()) return;
      }
      this.slain = true;
    }
    this.say("Герой идет к сундуку.");
    d = this.gap(hero, this.chest, hx) + P * 3; t = Math.max(320, (d - hx) / .34);
    this.tx(hero, d, t); await dgWait(reduced ? 0 : t + 80); if (!live()) return; this.tx(hero, d);
    if (outcome === "win") {
      this.put(this.chest, "chest_" + this.tier[0] + "_open"); this.chestbox.classList.add("open");
      this.loot.innerHTML = ""; this.tier[1].forEach(function (k) { var c = dgSprite(k); if (c) this.loot.appendChild(c); }, this);
      this.banner(this.star ? "Тайная комната найдена!" : "Комната пройдена!"); hero.classList.add("cheer");
      var gave = dgBagAdd(this.tier[1], this.file);
      this.say(gave ? "Сундук открыт. Лут уходит в сумку." : "Сундук открыт. Лут за эту комнату уже в сумке.");
      await dgWait(reduced ? 0 : 1500); if (!live()) return;
      this.loot.innerHTML = ""; hero.classList.remove("cheer"); this.updateHud();
      return;
    }
    this.chestbox.classList.add("shake"); await dgWait(reduced ? 0 : 420); if (!live()) return;
    this.put(this.chest, "mimic"); this.banner("Это мимик!", true);
    this.tx(hero, d - P * 5); await dgWait(reduced ? 0 : 380); if (!live()) return;
    this.chestbox.classList.remove("shake"); this.chestbox.classList.add("bite"); hero.classList.add("hurt");
    await dgWait(reduced ? 0 : 240); if (!live()) return;
    this.chestbox.classList.remove("bite"); hero.className = "dg-actor still"; hero.style.transform = ""; this.put(hero, "tomb");
    this.dead = true;
    var bag = dgBag(); this.potion.hidden = !(bag.potion > 0);
    this.say("Не пройдены 1–2 теста: сундук оказался мимиком. Исправьте решение и запустите проверку снова" + (bag.potion > 0 ? " или выпейте зелье." : "."));
  };
  /* итоговая задача страницы 6.9: страж таблицы, каждый герой с пройденным этажом наносит удар */
  DScene.prototype.finalFight = async function (outcome, live) {
    var P = this.px(), boss = this.mobs.firstChild, g = loadG();
    if (g.boss) { this.say("Страж уже повержен."); return; }
    this.standUp(); this.put(boss, "boss"); boss.className = "dg-actor dg-boss";
    if (outcome !== "win") {
      this.banner("Страж отбил удар!", true); this.say("Решение пока не проходит тесты: страж таблицы не дрогнул. Исправьте решение и запустите проверку снова.");
      this.tx(boss, -P * 7); await dgWait(reduced ? 0 : 220); this.tx(boss, 0); return;
    }
    var fl = dgFloorsDone(), hits = DG.PARTY.filter(function (p) { return fl[p[2]]; }), life = 4, bag = dgBag(), gem = bag.gem > 0;
    this.say("Отряд идет на стража таблицы.");
    var hero = this.hero;
    for (var r = 0; r < hits.length + (gem ? 1 : 0); r++) {
      var name = r < hits.length ? hits[r][1] : "Самоцвет";
      if (r < hits.length) this.put(hero, hits[r][0]);
      var d = this.gap(hero, boss, 0) + P * 6, t = Math.max(320, d / .42);
      this.say(name + (r < hits.length ? " бьет стража." : " вставлен в оружие: лишний удар."));
      this.tx(hero, d, t); await dgWait(reduced ? 0 : t + 60); if (!live()) return;
      this.tx(boss, -P * 7); await dgWait(reduced ? 0 : 170); this.tx(hero, d - P * 6); await dgWait(reduced ? 0 : 160); if (!live()) return;
      this.tx(boss, 0); this.tx(hero, d + P * 5); await dgWait(reduced ? 0 : 130); boss.classList.add("hurt"); this.tx(boss, P * 5); life--;
      await dgWait(reduced ? 0 : 190); if (!live()) return; boss.classList.remove("hurt"); this.tx(boss, 0);
      this.tx(hero, 0, t * .8); await dgWait(reduced ? 0 : t * .8 + 80); if (!live()) return; this.tx(hero, 0);
    }
    if (life > 0) {
      this.banner("Страж устоял", true);
      this.say("У стража осталось жизней: " + life + ". Каждый герой с пройденным этажом бьет один раз: пройдите остальные этажи.");
      return;
    }
    boss.classList.add("dead"); await dgWait(reduced ? 0 : 650); if (!live()) return;
    var g2 = loadG(); g2.boss = true; g2.bag = g2.bag || {}; g2.bag.crown = 1; if (gem && g2.bag.gem > 0) g2.bag.gem--; saveG(g2);
    this.put(this.chest, "portal"); this.loot.innerHTML = ""; this.chestbox.classList.add("open");
    ["crown", "gem", "coin"].forEach(function (k) { var c = dgSprite(k); if (c) this.loot.appendChild(c); }, this);
    this.hero.classList.add("cheer"); this.banner("Страж повержен!");
    this.say("Страж таблицы повержен. Портал открыт, корона в сумке.");
    await dgWait(reduced ? 0 : 1400);
  };

  /* ---------------- финальная игра темы «Подземелье» (версия 121) ----------------
     Платформер в графике залов (DungeonArt): четыре этажа и страж таблицы, меч (Z, X, K) и прыжок на монстра.
     Герои сменяют друг друга на этажах, страж оглушается после удара о землю, четыре удара отряда по очереди.
     Вход, число сердец на старте и значок те же, что у прежней игры; оценку игра не меняет. */
  var DA = {
    VW: 320, VH: 180, GY: 140, MAXH: 5,
    HEROES: [["keeper", "Ключница"], ["ranger", "Следопыт"], ["alchemist", "Алхимик"], ["scribe", "Рунный писец"]],
    STAGES: [
      { f: "f1", name: "Старое кладбище", hero: 0, mon: "skeleton", chest: "wood", loot: ["coin", "key"] },
      { f: "f2", name: "Крипта с жаровней", hero: 1, mon: "ghost", chest: "iron", loot: ["coin", "key", "potion"] },
      { f: "f3", name: "Витражный зал", hero: 2, mon: "slime", chest: "gold", loot: ["coin", "key", "potion"] },
      { f: "f4", name: "Пещера", hero: 3, mon: "goblin", chest: "crystal", loot: ["coin", "key", "gem"] },
      { f: "f5", name: "Логово стража", hero: 0, mon: "bat", boss: true }
    ],
    LOOTNAME: { coin: "монета", key: "ключ", potion: "зелье", gem: "самоцвет" }
  };
  function daRng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function daHit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function DArcade() {
    var self = this;
    this.ov = document.createElement("div"); this.ov.className = "arc-overlay"; this.ov.setAttribute("role", "dialog"); this.ov.setAttribute("aria-label", "Финальная игра");
    this.ov.innerHTML = '<div class="arc-box"><div class="arc-top"><span class="arc-stage"></span><span class="arc-hp"></span><button type="button" class="arc-close">Закрыть</button></div>' +
      '<canvas class="arc-canvas" width="' + DA.VW + '" height="' + DA.VH + '" tabindex="0" aria-label="Игровое поле: стрелки, пробел и клавиша Z"></canvas>' +
      '<p class="arc-msg" aria-live="polite"></p><div class="arc-pad"><div><button type="button" data-k="left" aria-label="Влево">◀</button><button type="button" data-k="right" aria-label="Вправо">▶</button></div>' +
      '<div><button type="button" data-k="atk" aria-label="Удар мечом">⚔</button><button type="button" data-k="jump" aria-label="Прыжок">▲</button></div></div></div>';
    document.body.appendChild(this.ov);
    this.cv = this.ov.querySelector("canvas"); this.cv.style.background = "#17151F"; this.c = this.cv.getContext("2d"); this.c.imageSmoothingEnabled = false;
    this.keys = { left: 0, right: 0, jump: 0, atk: 0 }; this.jumpBuf = 0; this.atkBuf = 0;
    var map = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "jump", KeyW: "jump", Space: "jump", KeyZ: "atk", KeyX: "atk", KeyK: "atk" };
    this.onKey = function (e) {
      if (e.key === "Escape") { self.close(); return; }
      var k = map[e.code]; if (!k) return;
      e.preventDefault();
      if (e.type === "keydown") { if (!self.keys[k]) self.press(k); self.keys[k] = 1; } else self.keys[k] = 0;
    };
    this.ov.querySelector(".arc-close").addEventListener("click", function () { self.close(); });
    Array.prototype.forEach.call(this.ov.querySelectorAll(".arc-pad button"), function (b) {
      var k = b.getAttribute("data-k");
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); if (!self.keys[k]) self.press(k); self.keys[k] = 1; });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, function () { self.keys[k] = 0; }); });
    });
    var pr = practiceDone() || { first: 0, total: 1 };
    this.startHp = Math.max(2, Math.min(DA.MAXH, 2 + Math.round(3 * pr.first / Math.max(1, pr.total))));
    this.hearts = this.startHp; this.coins = 0; this.bag = { key: 0, potion: 0, gem: 0, crown: 0 }; this.flawless = true;
    this.stage = 0; this.t = 0; this.fade = 0; this.pending = null; this.cache = {};
    this.load(0);
    this.msg("Пройдите четыре этажа и победите стража таблицы. Сердец на старте: " + this.startHp + ". Меч: Z, X или K, прыжок: пробел.");
  }
  DArcade.prototype.press = function (k) { if (k === "jump") this.jumpBuf = 8; if (k === "atk") this.atkBuf = 6; };
  DArcade.prototype.msg = function (t) { this.ov.querySelector(".arc-msg").textContent = t; };
  DArcade.prototype.open = function () {
    var self = this;
    this.ov.hidden = false; document.addEventListener("keydown", this.onKey); document.addEventListener("keyup", this.onKey);
    this.cv.focus(); this.running = true; this.last = 0; this.acc = 0;
    var tick = function (ts) {
      if (!self.running) return;
      self.acc += Math.min(100, ts - (self.last || ts)); self.last = ts;
      while (self.acc >= 1000 / 60) { self.acc -= 1000 / 60; self.step(); }
      self.draw(); window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };
  DArcade.prototype.close = function () {
    this.running = false; this.ov.hidden = true; this.keys = { left: 0, right: 0, jump: 0, atk: 0 };
    document.removeEventListener("keydown", this.onKey); document.removeEventListener("keyup", this.onKey);
  };
  DArcade.prototype.hud = function () {
    var st = DA.STAGES[this.stage], h = "", i, b = this.bag;
    for (i = 0; i < DA.MAXH; i++) h += i < this.hearts ? "♥" : "♡";
    this.ov.querySelector(".arc-stage").textContent = "Этаж " + (this.stage + 1) + " из 5 · " + st.name + " · " + DA.HEROES[st.boss ? this.relay : st.hero][1];
    var bag = [b.key ? "ключи " + b.key : "", b.potion ? "зелья " + b.potion : "", b.gem ? "самоцветы " + b.gem : "", b.crown ? "корона" : ""].filter(Boolean).join(" · ");
    this.ov.querySelector(".arc-hp").textContent = h + "  ● " + this.coins + (bag ? "  " + bag : "");
  };
  DArcade.prototype.load = function (s) {
    var st = DA.STAGES[s], r = daRng(101 + s * 17), VW = DA.VW, GY = DA.GY, self = this;
    this.stage = s; this.pits = []; this.plats = []; this.items = []; this.foes = []; this.fx = []; this.waves = []; this.boss = null; this.grave = null; this.chestOpen = false; this.cam = 0; this.relay = 0;
    this.hero = { x: 30, y: GY, vx: 0, vy: 0, w: 10, h: 24, face: 1, on: true, inv: 0, atk: 0, hit: 0, coy: 0, knock: 0, kdir: 1, swing: 0, id: DA.HEROES[st.hero][0] };
    this.state = "play";
    if (st.boss) {
      this.L = VW; this.chestX = -999;
      this.boss = { x: 232, y: GY, hp: 4, state: "walk", timer: 120, face: -1, flash: 0, hurt: 0, dead: 0 };
      this.hero.x = 40; this.hero.id = DA.HEROES[0][0]; this.hud(); return;
    }
    this.L = 1500 + s * 140; this.chestX = this.L - 56;
    var x = 250, k, w, i, y, y2, cnt;
    while (x < this.L - 230) {
      k = r();
      if (k < .30) {
        w = 30 + (r() * 10 | 0); this.pits.push([x, x + w]);
        for (i = 0; i < 5; i++) this.items.push({ x: x + 4 + i * (w - 8) / 4, y: GY - 28 - Math.sin(i / 4 * Math.PI) * 26, got: 0 });
        x += w + 70 + (r() * 60 | 0);
      } else if (k < .55) {
        w = 56 + (r() * 24 | 0); y = GY - 40; this.plats.push({ x: x, y: y, w: w });
        for (i = 0; i < 3; i++) this.items.push({ x: x + 12 + i * (w - 24) / 2, y: y - 12, got: 0 });
        if (r() < .5) { y2 = y - 34; this.plats.push({ x: x + w + 24, y: y2, w: 46 }); this.items.push({ x: x + w + 47, y: y2 - 12, got: 0 }); }
        x += w + 110 + (r() * 50 | 0);
      } else {
        cnt = 1 + (r() < .4 ? 1 : 0) + (s > 1 && r() < .4 ? 1 : 0);
        for (i = 0; i < cnt; i++) this.addFoe(st.mon, x + i * 26, r);
        x += 120 + (r() * 60 | 0);
      }
    }
    for (i = 0; i < 4 + s; i++) this.addFoe(st.mon, 330 + i * ((this.L - 600) / (4 + s)) + (r() * 40 | 0), r);
    this.foes = this.foes.filter(function (f) { return !self.pits.some(function (p) { return f.x0 > p[0] - 30 && f.x0 < p[1] + 30; }); });
    this.hud();
  };
  DArcade.prototype.addFoe = function (type, x, r) {
    var s = DungeonArt.sprite(type), fly = type === "bat" || type === "ghost", GY = DA.GY;
    this.foes.push({ t: type, x: x, x0: x, y: fly ? GY - 36 - (r() * 20 | 0) : GY, baseY: fly ? GY - 40 : GY, vx: type === "goblin" ? .7 : .5, vy: 0, dir: r() < .5 ? -1 : 1,
      w: Math.round(s.w * .8), h: Math.round(s.h * .9), hp: type === "goblin" ? 2 : 1, hop: 30 + (r() * 60 | 0), flash: 0, dead: 0, id: 0, ph: r() * 6 });
  };
  DArcade.prototype.solid = function (x) { return !this.pits.some(function (p) { return x > p[0] + 3 && x < p[1] - 3; }); };
  DArcade.prototype.spark = function (x, y, col, n) { for (var i = 0; i < n; i++) this.fx.push({ x: x, y: y, vx: (Math.random() - .5) * 3, vy: -Math.random() * 2.5, life: 24 + Math.random() * 14, col: col }); };
  DArcade.prototype.hurt = function (from) {
    var h = this.hero; if (h.inv > 0 || this.state !== "play") return;
    this.hearts--; this.flawless = false; h.inv = 90; h.vy = -3.6; h.knock = 12; h.kdir = from >= 0 ? (h.x < from ? -1 : 1) : -h.face; this.spark(h.x, h.y - 12, "#ff6a5a", 6);
    if (this.hearts <= 0) this.die(); else this.hud();
  };
  DArcade.prototype.die = function () {
    this.state = "dead"; this.grave = { x: this.hero.x, y: Math.min(this.hero.y, DA.GY) }; this.hud();
    this.msg("Герой пал. Этап начнется заново, сердец: " + this.startHp + ".");
    this.deadT = 90;
  };
  DArcade.prototype.step = function () {
    var self = this, h = this.hero, st = DA.STAGES[this.stage], GY = DA.GY, VW = DA.VW, VH = DA.VH, ax, oy, ny, body, sword, i;
    this.t++;
    if (this.fade > 0 && this.pending !== null) {
      this.fade += .05;
      if (this.fade >= 1.5) { this.stage = this.pending; this.pending = null; this.load(this.stage); this.fade = 1; this.msg("Этаж " + (this.stage + 1) + ": " + DA.STAGES[this.stage].name + (DA.STAGES[this.stage].boss ? ". Бейте стража, когда он оглушен." : ".")); }
      return;
    } else if (this.fade > 0) this.fade = Math.max(0, this.fade - .05);
    if (this.state === "dead") { if (--this.deadT <= 0) { this.hearts = this.startHp; this.load(this.stage); } return; }
    if (this.state === "stagewin" || this.state === "win") {
      this.timer--; this.fx.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += .06; p.life--; }); this.fx = this.fx.filter(function (p) { return p.life > 0; });
      if (this.state === "stagewin" && this.timer <= 0 && this.pending === null) { this.fade = 1; this.pending = this.stage + 1; }
      return;
    }
    if (this.state !== "play") return;
    ax = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    if (h.knock > 0) { h.knock--; h.x += h.kdir * 1.6; } else { h.vx += (ax * 1.7 - h.vx) * .35; h.x += h.vx; if (ax) h.face = ax; }
    h.x = Math.max(8, Math.min(this.L - 8, h.x));
    if (this.jumpBuf > 0) this.jumpBuf--; if (this.atkBuf > 0) this.atkBuf--;
    if (h.on) h.coy = 6; else if (h.coy > 0) h.coy--;
    if (this.jumpBuf > 0 && h.coy > 0) { h.vy = -6.4; h.on = false; h.coy = 0; this.jumpBuf = 0; }
    if (!this.keys.jump && h.vy < -2.4) h.vy = -2.4;
    h.vy = Math.min(8, h.vy + .4);
    oy = h.y; ny = h.y + h.vy; h.on = false;
    if (h.vy >= 0) {
      if (this.solid(h.x) && oy <= GY && ny >= GY) { ny = GY; h.vy = 0; h.on = true; }
      this.plats.forEach(function (p) { if (h.x > p.x - 2 && h.x < p.x + p.w + 2 && oy <= p.y && ny >= p.y) { ny = p.y; h.vy = 0; h.on = true; } });
    }
    h.y = ny;
    if (h.y > VH + 30) {
      this.hearts--; this.flawless = false; this.spark(h.x, VH - 6, "#ffd081", 8);
      if (this.hearts <= 0) { h.y = VH + 30; this.die(); return; }
      h.inv = 90; var x = h.x; while (!this.solid(x) || !this.solid(x - 20)) x -= 6; h.x = Math.max(20, x - 24); h.y = GY; h.vy = 0; h.vx = 0; this.hud();
    }
    if (h.inv > 0) h.inv--;
    if (this.atkBuf > 0 && h.atk <= 0 && h.hit <= 0) { h.atk = 12; h.hit = 22; this.atkBuf = 0; h.swing++; }
    if (h.atk > 0) h.atk--; if (h.hit > 0) h.hit--;
    body = { x: h.x - 5, y: h.y - 24, w: 10, h: 24 };
    sword = h.atk > 0 ? { x: h.face > 0 ? h.x + 2 : h.x - 28, y: h.y - 28, w: 26, h: 26 } : null;
    this.items.forEach(function (c) { if (!c.got && Math.abs(c.x - h.x) < 10 && Math.abs(c.y - (h.y - 12)) < 14) { c.got = 1; self.coins++; self.spark(c.x, c.y, "#ffe08a", 4); self.hud(); } });
    for (i = 0; i < this.foes.length; i++) {
      var f = this.foes[i], near, fb, d;
      if (f.dead) { f.dead--; continue; }
      if (f.flash > 0) f.flash--;
      near = Math.abs(h.x - f.x) < 110;
      if (f.t === "skeleton") { f.x += f.dir * f.vx; if (Math.abs(f.x - f.x0) > 45) f.dir *= -1; }
      else if (f.t === "goblin") { f.dir = near ? Math.sign(h.x - f.x) || 1 : f.dir; f.x += f.dir * (near ? 1.15 : .6); if (!near && Math.abs(f.x - f.x0) > 50) f.dir *= -1; }
      else if (f.t === "slime") { f.x += f.dir * .35; f.hop--; if (f.hop <= 0 && f.y >= GY) { f.vy = -4.2; f.hop = 60 + (f.ph * 7 | 0); } f.vy += .35; f.y = Math.min(GY, f.y + f.vy); if (f.y >= GY) f.vy = 0; if (Math.abs(f.x - f.x0) > 40) f.dir *= -1; }
      else if (f.t === "ghost") { d = near ? Math.sign(h.x - f.x) : f.dir; f.x += d * .55; f.y = f.baseY + Math.sin(this.t / 22 + f.ph) * 9; if (!near && Math.abs(f.x - f.x0) > 70) f.dir *= -1; }
      else if (f.t === "bat") { f.x += f.dir * .9; f.y = f.baseY + Math.sin(this.t / 12 + f.ph) * 16; if (Math.abs(f.x - f.x0) > 80) f.dir *= -1; }
      fb = { x: f.x - f.w / 2, y: f.y - f.h, w: f.w, h: f.h };
      if (sword && daHit(sword, fb) && f.id !== h.swing) { f.id = h.swing; this.kill(f); continue; }
      if (daHit(body, fb)) { if (h.vy > 1 && h.y - 4 < fb.y + 8) { this.kill(f); h.vy = -4.6; } else this.hurt(f.x); }
    }
    if (!st.boss && !this.chestOpen && Math.abs(h.x - this.chestX) < 16 && h.y >= GY - 4) this.openChest();
    this.fx.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += .08; p.life--; }); this.fx = this.fx.filter(function (p) { return p.life > 0; });
    if (this.boss) this.stepBoss(body, sword);
    this.cam += (Math.max(0, Math.min(this.L - VW, h.x - 130)) - this.cam) * .12;
  };
  DArcade.prototype.kill = function (f) {
    f.hp--; f.flash = 8; this.spark(f.x, f.y - f.h / 2, "#fff0c4", 5);
    if (f.hp <= 0) { f.dead = 30; this.items.push({ x: f.x, y: f.y - f.h - 4, got: 0 }); }
  };
  DArcade.prototype.openChest = function () {
    var st = DA.STAGES[this.stage], self = this;
    this.chestOpen = true; this.state = "stagewin"; this.timer = 150;
    st.loot.forEach(function (i) { if (self.bag[i] !== undefined) self.bag[i]++; });
    this.hearts = Math.min(DA.MAXH, this.hearts + 1); this.spark(this.chestX, DA.GY - 20, "#ffe08a", 20); this.hud();
    this.msg("Этаж пройден. Сундук открыт: " + st.loot.map(function (i) { return DA.LOOTNAME[i]; }).join(", ") + ". Сердце +1.");
  };
  DArcade.prototype.stepBoss = function (body, sword) {
    var b = this.boss, h = this.hero, GY = DA.GY, VW = DA.VW, self = this, bb;
    if (b.dead) { b.dead++; if (b.dead === 60) this.win(); return; }
    if (b.flash > 0) b.flash--; if (b.hurt > 0) b.hurt--;
    b.face = h.x < b.x ? -1 : 1;
    if (b.state === "walk") { b.x += b.face * .35; b.timer--; if (b.timer <= 0) { b.state = "wind"; b.timer = 50; } }
    else if (b.state === "wind") { b.timer--; if (b.timer <= 0) { b.state = "slam"; b.timer = 16; this.waves.push({ x: b.x - 20, dir: -1 }, { x: b.x + 20, dir: 1 }); this.spark(b.x, GY, "#ffd081", 10); } }
    else if (b.state === "slam") { b.timer--; if (b.timer <= 0) { b.state = "stun"; b.timer = 110; } }
    else if (b.state === "stun") { b.timer--; if (b.timer <= 0) { b.state = "walk"; b.timer = 140; } }
    b.x = Math.max(60, Math.min(VW - 36, b.x));
    this.waves.forEach(function (w) { w.x += w.dir * 2; });
    this.waves.forEach(function (w) { if (h.y >= GY - 10 && Math.abs(w.x - h.x) < 7) self.hurt(w.x); });
    this.waves = this.waves.filter(function (w) { return w.x > -10 && w.x < VW + 10; });
    bb = { x: b.x - 22, y: GY - 62, w: 44, h: 62 };
    if (daHit(body, bb) && b.state === "walk") this.hurt(b.x);
    if (sword && daHit(sword, bb) && b.hurt <= 0) {
      if (b.state === "stun") {
        b.hp--; b.hurt = 40; b.flash = 10; this.spark(b.x, GY - 40, "#fff0c4", 12);
        this.relay = (this.relay + 1) % 4; h.id = DA.HEROES[this.relay][0]; this.hud();
        this.msg(DA.HEROES[(this.relay + 3) % 4][1] + " бьет стража." + (b.hp > 0 ? " Следующий удар за " + DA.HEROES[this.relay][1] + "." : " Страж повержен."));
        if (b.hp <= 0) { b.dead = 1; this.spark(b.x, GY - 30, "#ffd081", 30); b.state = "dead"; }
      } else { b.hurt = 14; this.spark(b.x - b.face * 20, GY - 36, "#99aaaa", 4); this.msg("Удар отбит: бейте, когда страж оглушен после удара о землю."); }
    }
  };
  DArcade.prototype.win = function () {
    this.state = "win"; this.timer = 9999; this.bag.crown++; this.coins += 5; this.over = true; this.hud();
    this.msg("Страж таблицы повержен, портал открыт, корона в рюкзаке. Практика пройдена! Монет: " + this.coins + ".");
    this.badge("arcade", "Финальная игра пройдена");
    if (this.flawless) this.badge("scratchless", "Без единой царапины");
  };
  DArcade.prototype.badge = function (key, name) {
    var g = loadG();
    if (!g.badges[key]) { g.badges[key] = true; saveG(g); toast("Значок: " + name); }
  };
  DArcade.prototype.pattern = function (key) {
    if (this.cache[key]) return this.cache[key];
    var T = DungeonArt.tools, w = DungeonArt.FLOORS[key], c = document.createElement("canvas"), g, row, b, x, y, n, base, back;
    c.width = 64; c.height = 48; g = c.getContext("2d");
    T.rect(g, 0, 0, 64, 48, T.mix(w.face, T.INK, .55));
    for (row = 0; row < 6; row++) {
      var off = row % 2 ? 16 : 0;
      for (b = -1; b < 3; b++) {
        x = b * 32 + off; y = row * 8; n = T.noise(b + row * 7, row, w.room);
        base = T.mix(T.mix(w.wall, w.face, .4), n > .5 ? "#a1999d" : "#242532", Math.abs(n - .5) * .4);
        T.rect(g, x + 1, y + 1, 31, 7, base); T.rect(g, x + 1, y + 1, 31, 1, T.mix(base, w.light, .14)); T.rect(g, x + 1, y + 7, 31, 1, T.mix(base, T.INK, .35));
      }
    }
    back = document.createElement("canvas"); back.width = 456; back.height = 240; T.backdrop(back.getContext("2d"), w, w.room + 2);
    return (this.cache[key] = { wall: c, back: back });
  };
  DArcade.prototype.blit = function (name, x, y, o) {
    var s = DungeonArt.sprite(name), c = this.c, sc, wd, ht; if (!s) return;
    sc = o.s || 1; wd = s.w * sc; ht = s.h * sc;
    c.save(); if (o.a != null) c.globalAlpha = o.a;
    c.translate(Math.round(x - Math.round(this.cam)), Math.round(y)); if (o.flip) c.scale(-1, 1);
    c.drawImage(s.canvas, -Math.round(wd / 2), -ht, wd, ht); c.restore();
  };
  DArcade.prototype.draw = function () {
    var T = DungeonArt.tools, ctx = this.c, st = DA.STAGES[this.stage], w = DungeonArt.FLOORS[st.f], P = this.pattern(st.f), cx = Math.round(this.cam), t = this.t,
      VW = DA.VW, VH = DA.VH, GY = DA.GY, self = this, i, k, x, a, c0, n, sx, body, pts, wx, bx, wo, h;
    ctx.clearRect(0, 0, VW, VH);
    bx = -Math.floor((cx * .25) % 456); ctx.drawImage(P.back, bx, -40); ctx.drawImage(P.back, bx + 456, -40);
    wo = Math.floor(cx * .7) % 64;
    ctx.save(); ctx.translate(-wo, 0); ctx.fillStyle = ctx.createPattern(P.wall, "repeat"); ctx.fillRect(0, 18, VW + 64, GY - 18 + 4); ctx.restore();
    ctx.fillStyle = "rgba(10,8,16,.38)"; ctx.fillRect(0, 18, VW, GY - 14);
    for (a = -1; a < 4; a++) {
      wx = Math.floor(a * 160 + 70 - (cx * .7) % 160);
      pts = [[-18, 0], [-18, -46], [-12, -58], [0, -66], [12, -58], [18, -46], [18, 0]].map(function (q) { return [wx + q[0], GY + q[1]]; });
      T.poly(ctx, pts.map(function (q) { return [q[0] - 3, q[1] - 3]; }), T.mix(w.wall, w.light, .22)); T.poly(ctx, pts, T.mix(w.dark, T.INK, .35));
      T.glow(ctx, wx, GY - 30, 22, w.magic, .05);
    }
    T.rect(ctx, 0, 0, VW, 18, T.mix(w.dark, T.INK, .4)); T.rect(ctx, 0, 17, VW, 2, T.mix(w.wall, T.INK, .3));
    for (i = -1; i < 20; i++) { x = i * 24 - ((cx * .9) % 24); var hh = 5 + T.noise(i + Math.floor(cx * .9 / 24), 3) * 9; T.poly(ctx, [[x, 18], [x + 10, 18], [x + 5, 18 + hh]], T.mix(w.dark, T.INK, .5)); }
    for (k = Math.floor(cx / 224) - 1; k < Math.floor((cx + VW) / 224) + 2; k++) {
      x = k * 224 + 100 - cx;
      T.rect(ctx, x - 8, 18, 16, GY - 18, T.mix(w.wall, "#c5b2a8", .3)); T.rect(ctx, x - 8, 18, 3, GY - 18, T.mix(w.wall, w.light, .35)); T.rect(ctx, x + 4, 18, 4, GY - 18, T.mix(w.face, T.INK, .3));
      for (var yy = 30; yy < GY - 6; yy += 14) T.rect(ctx, x - 7, yy, 14, 1, T.mix(w.face, T.INK, .35));
      T.rect(ctx, x - 10, 18, 20, 5, T.mix(w.wall, w.light, .2)); T.rect(ctx, x - 10, GY - 6, 20, 6, T.mix(w.wall, w.light, .2));
      T.rect(ctx, x + 8, 66, 5, 2, w.metal); T.rect(ctx, x + 10, 62, 3, 4, T.mix(w.metal, T.INK, .4));
      T.glow(ctx, x + 11, 56, 30, "#ffc177", .24); T.flame(ctx, x + 11, 62, w, t / 60, k & 3);
    }
    c0 = Math.floor(cx / 16) * 16;
    for (x = c0; x < cx + VW + 16; x += 16) {
      if (!this.solid(x + 8)) continue;
      n = T.noise(x / 16, 5, w.room); sx = x - cx; var body2 = T.mix(w.face, w.tile, .25 + n * .25);
      T.rect(ctx, sx, GY, 16, VH - GY, body2); T.rect(ctx, sx, GY, 16, 3, T.mix(w.tile, w.light, .3)); T.rect(ctx, sx, GY + 3, 16, 1, T.mix(body2, T.INK, .4));
      T.rect(ctx, sx + 15, GY, 1, VH - GY, T.mix(body2, T.INK, .45)); T.rect(ctx, sx, GY + 15, 16, 1, T.mix(body2, T.INK, .4)); T.rect(ctx, sx, GY + 30, 16, 1, T.mix(body2, T.INK, .35));
      if (n > .6) T.rect(ctx, sx + 3, GY + 9, 5, 1, T.mix(body2, w.light, .18));
    }
    this.pits.forEach(function (p) {
      var s0 = p[0] - cx; if (s0 > VW || p[1] - cx < 0) return;
      T.rect(ctx, s0, GY, p[1] - p[0], VH - GY, T.mix(w.dark, T.INK, .55)); T.glow(ctx, (s0 + p[1] - cx) / 2, VH - 2, 34, w.magic, .3);
      T.rect(ctx, s0 - 1, GY, 2, VH - GY, T.mix(w.face, T.INK, .5)); T.rect(ctx, p[1] - cx - 1, GY, 2, VH - GY, T.mix(w.face, T.INK, .5));
    });
    this.plats.forEach(function (p) {
      var s0 = p.x - cx; if (s0 > VW || s0 + p.w < 0) return;
      T.rect(ctx, s0, p.y, p.w, 5, T.mix(w.tile, w.light, .3)); T.rect(ctx, s0, p.y + 5, p.w, 9, T.mix(w.face, w.tile, .3)); T.rect(ctx, s0, p.y + 13, p.w, 2, T.mix(w.face, T.INK, .5));
      for (var q = 8; q < p.w; q += 14) T.rect(ctx, s0 + q, p.y + 5, 1, 9, T.mix(w.face, T.INK, .4));
      T.rect(ctx, s0, p.y, p.w, 1, T.mix(w.tile, "#ffffff", .25));
    });
    if (!st.boss) { T.glow(ctx, this.chestX - cx, GY - 12, 22, w.magic, this.chestOpen ? .35 : .14); this.blit("chest_" + st.chest + (this.chestOpen ? "_open" : ""), this.chestX, GY, {}); }
    this.items.forEach(function (c) { if (!c.got) self.blit("coin", c.x, c.y + 4 + Math.sin(t / 10 + c.x) * 1.5, {}); });
    this.foes.forEach(function (f) {
      var al = f.dead ? f.dead / 30 : 1; if (f.dead && f.dead < 1) return;
      ctx.save(); if (f.flash > 0 && t % 2) ctx.globalAlpha = .5; self.blit(f.t, f.x, f.y, { flip: f.dir > 0, a: al }); ctx.restore();
    });
    if (this.boss) this.drawBoss(w);
    if (this.state === "stagewin" && !st.boss) st.loot.forEach(function (id, j, arr) { var up = Math.min(30, (150 - self.timer) * .8); self.blit(id, self.chestX + (j - (arr.length - 1) / 2) * 14, GY - 28 - up, {}); });
    h = this.hero;
    if (this.grave) this.blit("tomb", this.grave.x, this.grave.y, {});
    else {
      var blink = h.inv > 0 && Math.floor(h.inv / 4) % 2;
      if (!blink || this.state !== "play") this.blit(h.id, h.x, h.y + (h.on && Math.abs(h.vx) > .3 && Math.floor(t / 6) % 2 ? -1 : 0), { flip: h.face < 0 });
      if (h.atk > 0) {
        var kk = 1 - h.atk / 12, dir = h.face, sx2 = h.x - cx, sy2 = h.y - 14, ang;
        for (i = 0; i < 9; i++) { ang = -1.3 + (kk * 2.6) * (i / 8) - .2; T.rect(ctx, Math.round(sx2 + dir * (6 + Math.cos(ang) * 20)), Math.round(sy2 + Math.sin(ang) * 20), 2, 2, i > 5 ? "#ffffff" : w.magic); }
      }
    }
    this.fx.forEach(function (p) { T.rect(ctx, Math.round(p.x - (self.boss ? 0 : cx)), Math.round(p.y), 2, 2, p.col); });
    if (this.fade > 0) { ctx.fillStyle = "rgba(10,8,16," + Math.min(1, this.fade) + ")"; ctx.fillRect(0, 0, VW, VH); }
  };
  DArcade.prototype.drawBoss = function (w) {
    var T = DungeonArt.tools, ctx = this.c, b = this.boss, t = this.t, GY = DA.GY, i, shake, al;
    if (b.dead > 40) return;
    T.rect(ctx, Math.round(b.x - 24), GY - 2, 48, 3, "rgba(0,0,0,.35)");
    shake = b.state === "wind" ? Math.sin(t * 2) * 1.5 : 0; al = b.dead ? Math.max(0, 1 - b.dead / 40) : 1;
    if (b.state === "stun") T.glow(ctx, b.x, GY - 50, 34, "#fff1c7", .25 + Math.sin(t / 5) * .1);
    ctx.save(); if (b.flash > 0 && t % 2) ctx.globalAlpha = .5; this.blit("boss", b.x + shake, GY, { s: 2, flip: b.face > 0, a: al }); ctx.restore();
    if (b.state === "wind") T.star(ctx, Math.round(b.x), GY - 76, "#ff6a5a", 3);
    if (b.state === "stun") for (i = 0; i < 3; i++) T.star(ctx, Math.round(b.x - 10 + i * 10), Math.round(GY - 70 + Math.sin(t / 6 + i) * 2), "#ffe08a", 1);
    this.waves.forEach(function (wv) { T.rect(ctx, Math.round(wv.x) - 4, GY - 9, 8, 9, "#ffd081"); T.rect(ctx, Math.round(wv.x) - 2, GY - 12, 4, 3, "#fff1c7"); });
    for (i = 0; i < 4; i++) { var on = i < b.hp; T.rect(ctx, 100 + i * 28, 24, 24, 6, on ? "#e0687a" : "#2a2a30"); T.rect(ctx, 100 + i * 28, 24, 24, 1, on ? "#ffb0b8" : "#44454d"); }
  };

  /* ---------------- цикл ---------------- */
  var running = false;
  function loop() {
    if (root.getAttribute("data-profile") !== "game") { running = false; return; }
    scenes.forEach(function (s) { if (s.visible || s.mode !== "idle") { s.step(); s.draw(); } });
    window.requestAnimationFrame(loop);
  }

  function build() {
    if (scenes.length) return;
    var blocks = Array.prototype.slice.call(document.querySelectorAll(".checker[data-file]"));
    var count = blocks.length;
    /* версия 121: в теме «Подземелье» итоговая задача это последнее нумерованное упражнение страницы
       логова (f5): блока .task-final в страницах нет, поэтому страж появляется здесь */
    var lastNo = 0;
    if (THEME === "dungeon" && dgFloor(dgPageNo()) === "f5") blocks.forEach(function (b) {
      var m = /_(\d+)_(?:basic|medium|advanced)(?:\.py)?$/.exec(b.getAttribute("data-file") || ""); if (m) lastNo = Math.max(lastNo, +m[1]);
    });
    blocks.forEach(function (b, i) {
      var fm = /_(\d+)_(?:basic|medium|advanced)(?:\.py)?$/.exec(b.getAttribute("data-file") || "");
      var isFinal = !!b.closest(".task-final") || !!(lastNo && fm && +fm[1] === lastNo);
      scenes.push(THEME === "dungeon" && typeof DungeonArt !== "undefined" ? new DScene(b, i, count, isFinal) : new Scene(b, i, count, isFinal));
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          scenes.forEach(function (s) { if (s.wrap === e.target) s.visible = e.isIntersecting; });
        });
      }, { threshold: 0.3 });
      scenes.forEach(function (s) { io.observe(s.wrap); });
    } else {
      scenes.forEach(function (s) { s.visible = true; });
    }
    scenes.forEach(function (s) { s.draw(); });
  }

  function activate() {
    refreshHud();
    arcadeEntry();
    if (root.getAttribute("data-profile") !== "game") return;
    build();
    scenes.forEach(function (s) { s.updateHud(); s.draw(); });
    if (!running && !reduced) { running = true; window.requestAnimationFrame(loop); }
  }

  /* «Сбросить» в блоке проверки: сцена возвращается к началу (решенная остается решенной) */
  document.addEventListener("checker:reset", function (e) {
    scenes.forEach(function (s) { if (s.block === e.target) { s.reset(solvedTasks()[s.file] || state.done[s.file]); if (s.draw) s.draw(); } });
  });
  document.addEventListener("checker:start", function (e) {
    scenes.forEach(function (s) { if (s.block === e.target) s.start(); });
  });
  document.addEventListener("checker:result", function (e) {
    award(e.detail);
    scenes.forEach(function (s) { if (s.block === e.target) { s.result(e.detail); if (reduced) s.draw(); } });
  });
  root.addEventListener("practice:settings", activate);

  function init() {
    /* блоки проверки строит checker.js; ждем их */
    var tries = 0;
    (function wait() {
      if (document.querySelector(".checker .checker-bar") || tries > 40) activate();
      else { tries++; window.setTimeout(wait, 50); }
    })();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

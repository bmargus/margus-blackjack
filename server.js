const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const path=require('path');
const app=express();app.use(express.static(path.join(__dirname,'public')));
const server=http.createServer(app),io=new Server(server);
const NAMES=['Brad','Jarrett','Quinn'];
let game;
const fresh=()=>({phase:'LOBBY',humans:['Brad','Jarrett','Quinn'],players:[],dealer:{cards:[]},shoe:[],round:0,turn:0,events:[],logId:0,betMin:10,betMax:500,stats:null});
game=fresh();
const sum=cards=>{let v=0,a=0;for(const c of cards){if(c.r==='A'){v+=11;a++}else v+=['J','Q','K'].includes(c.r)?10:Number(c.r)}while(v>21&&a){v-=10;a--}return {total:v,soft:a>0};};
const bj=cards=>cards.length===2&&sum(cards).total===21;
const deck=()=>{let a=[];for(let n=0;n<6;n++)for(let s of ['♠','♥','♦','♣'])for(let r of ['A','2','3','4','5','6','7','8','9','10','J','Q','K'])a.push({r,s});for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;};
function card(){if(game.shoe.length<65)game.shoe=deck();return game.shoe.pop()}
function say(who,text,kind='talk'){game.events.push({id:++game.logId,who,text,kind});if(game.events.length>30)game.events.shift()}
function rand(a){return a[Math.floor(Math.random()*a.length)]}
function line(who,kind){const d={
 dealer:{start:['Place your bets. Let’s see what the cards have in mind.','Welcome back to the table. Good luck, everyone.'],blackjack:['Now that is a beautiful blackjack.','Twenty-one in two. Nicely done.'],bust:['That hand has left the building.','A little too much enthusiasm there.'],dealerBust:['Well. That was not my finest moment.','I appear to have donated to the table.'],win:['Nicely played.','The house pays.'],push:['A tie. Nobody gets bragging rights.']},
 Nerd:{blackjack:['Precisely the outcome I had modeled.','Finally, the mathematics cooperates.'],bust:['I object to that particular random variable.','An unfortunate excursion beyond twenty-one.'],win:['An entirely satisfactory result.'],lose:['The variance is becoming personal.'],hit:['The expected value supports this.']},
 Cowboy:{blackjack:['Well, slap a saddle on that twenty-one!','That’s what I call a fine pair of cards!'],bust:['That horse ran straight off the cliff.','Reckon I pushed my luck a mite.'],win:['Yeehaw! Drinks are on the house!'],lose:['Well, the trail gets dusty sometimes.'],hit:['Let’s ride.']}};
return rand((d[who]&&d[who][kind])||[])}
function react(name,kind){let x=line(name,kind);if(x)say(name,x,kind);if(kind==='bust'&&name==='Cowboy'&&Math.random()<.4)say('Nerd',rand(['An impressive disregard for probability.','The odds did warn you.']));if(kind==='bust'&&name==='Nerd'&&Math.random()<.4)say('Cowboy',rand(['Numbers didn’t save you, partner.','Guess your calculator needs a new battery.']));if(kind==='blackjack'&&Math.random()<.35)say('Dealer',line('dealer','blackjack'));}
function pstate(p){return {name:p.name,bot:p.bot,bank:p.bank,bet:p.bet,cards:p.hands.map(h=>({cards:h.cards,bet:h.bet,done:h.done,result:h.result,paid:h.paid})),handIndex:p.handIndex,stats:p.stats,connected:p.connected!==false};}
function publicState(){let current=game.players[game.turn];return {phase:game.phase,humans:game.humans,players:game.players.map(pstate),dealer:{cards:game.dealer.cards.map((c,i)=>game.phase==='PLAYING'&&i===1?{r:'?',s:'?'}:c)},round:game.round,current:current?.name||null,events:game.events,betMin:game.betMin,betMax:game.betMax,stats:game.stats};}
function send(){io.emit('state',publicState())}
function player(name,bot){return {name,bot,bank:1000,bet:0,hands:[],handIndex:0,connected:bot?true:false,stats:{won:0,lost:0,push:0,blackjacks:0,busts:0,biggest:0,net:0,hands:0},socketId:null};}
function setup(names){game=fresh();game.humans=names;game.players=[...names.map(n=>player(n,false)),player('Nerd',true),player('Cowboy',true)];game.phase='BETTING';say('Dealer',line('dealer','start'));send()}
function betting(){game.phase='BETTING';game.dealer.cards=[];game.turn=0;for(const p of game.players){p.bet=0;p.hands=[];p.handIndex=0;if(p.bot){if(p.bank<10)p.bank=1000;let size=p.name==='Cowboy'?rand([20,30,50,75,100]):rand([10,20,30,40]);p.bet=Math.min(p.bank,size);p.bank-=p.bet}}say('Dealer',rand(['New hand. Bets are open.','Place your bets, folks.','Let’s have another.']));send()}
function canDeal(){return game.players.filter(p=>!p.bot).every(p=>p.connected&&(p.bet>0||p.bank<10))}
function deal(){if(game.phase!=='BETTING'||!canDeal())return;game.round++;game.phase='PLAYING';for(let k=0;k<2;k++){for(const p of game.players)if(p.bet>0){if(k===0)p.hands=[{cards:[],bet:p.bet,done:false,result:null,paid:0}];p.hands[0].cards.push(card())}game.dealer.cards.push(card())}for(const p of game.players){if(p.hands.length&&bj(p.hands[0].cards)){p.hands[0].done=true;p.stats.blackjacks++;react(p.name,'blackjack')}}game.turn=0;send();advance()}
function currentHand(p){return p.hands[p.handIndex]}
function canSplit(p,h){return h.cards.length===2&&h.cards[0].r===h.cards[1].r&&p.bank>=h.bet&&p.hands.length<4}
function canDouble(p,h){return h.cards.length===2&&p.bank>=h.bet}
function action(p,type){if(game.phase!=='PLAYING'||game.players[game.turn]!==p)return;let h=currentHand(p);if(!h||h.done)return;
if(type==='hit'){h.cards.push(card());let v=sum(h.cards).total;if(v>=21){h.done=true;if(v>21){p.stats.busts++;react(p.name,'bust')}else react(p.name,'blackjack')}}
else if(type==='stand'){h.done=true}
else if(type==='double'&&canDouble(p,h)){p.bank-=h.bet;h.bet*=2;h.cards.push(card());h.done=true;if(sum(h.cards).total>21){p.stats.busts++;react(p.name,'bust')}else if(sum(h.cards).total===21)react(p.name,'blackjack')}
else if(type==='split'&&canSplit(p,h)){p.bank-=h.bet;const other=h.cards.pop();const nh={cards:[other,card()],bet:h.bet,done:false,result:null,paid:0};h.cards.push(card());p.hands.splice(p.handIndex+1,0,nh);if(h.cards[0].r==='A'){h.done=true;nh.done=true}for(const sh of [h,nh])if(sum(sh.cards).total===21)react(p.name,'blackjack')}
else return;
send();advance()}
function basic(p,h){let v=sum(h.cards),up=game.dealer.cards[0],u=['J','Q','K'].includes(up.r)?10:up.r==='A'?11:Number(up.r);const rank=c=>['J','Q','K'].includes(c.r)?10:c.r==='A'?11:Number(c.r);
if(canSplit(p,h)){let r=rank(h.cards[0]);if(r===11||r===8||(r===9&&![7,10,11].includes(u))||(r===7&&u<=7)||(r===6&&u<=6)||(r===4&&[5,6].includes(u))||(r===3&&u<=7)||(r===2&&u<=7))return 'split'}
if(canDouble(p,h)){if(!v.soft&&((v.total===11)||(v.total===10&&u<=9)||(v.total===9&&u>=3&&u<=6)))return 'double';if(v.soft&&((v.total===18&&u>=3&&u<=6)||(v.total===17&&u>=3&&u<=6)||(v.total===16&&u>=4&&u<=6)||(v.total===15&&u>=4&&u<=6)||(v.total===14&&u>=5&&u<=6)||(v.total===13&&u>=5&&u<=6)))return 'double'}
if(v.soft){if(v.total>=19)return 'stand';if(v.total===18)return [2,7,8].includes(u)?'stand':u>=9?'hit':'stand';return 'hit'}
if(v.total>=17)return 'stand';if(v.total>=13)return u<=6?'stand':'hit';if(v.total===12)return u>=4&&u<=6?'stand':'hit';return 'hit'}
let timer=null;
function advance(){if(timer){clearTimeout(timer);timer=null}if(game.phase!=='PLAYING')return;
while(game.turn<game.players.length){let p=game.players[game.turn];if(!p.hands.length){game.turn++;continue}while(p.handIndex<p.hands.length&&p.hands[p.handIndex].done)p.handIndex++;if(p.handIndex>=p.hands.length){game.turn++;continue}send();if(p.bot){timer=setTimeout(()=>{timer=null;if(game.phase!=='PLAYING')return;let h=currentHand(p);let choice=basic(p,h);if(p.name==='Cowboy'&&choice==='stand'&&sum(h.cards).total===12&&Math.random()<.15)choice='hit';if(Math.random()<.09&&choice==='hit')say(p.name,line(p.name,'hit'));action(p,choice)},850)}return}
finish()}
function finish(){game.phase='DEALER';send();timer=setTimeout(()=>{timer=null;const live=game.players.some(p=>p.hands.some(h=>sum(h.cards).total<=21&&!bj(h.cards)));if(live){while(sum(game.dealer.cards).total<17||(sum(game.dealer.cards).total===17&&sum(game.dealer.cards).soft===false&&false))game.dealer.cards.push(card())}let dv=sum(game.dealer.cards).total,dbj=bj(game.dealer.cards);if(dv>21){say('Dealer',line('dealer','dealerBust'),'dealerBust')}
for(const p of game.players)for(const h of p.hands){let v=sum(h.cards).total,natural=bj(h.cards)&&p.hands.length===1;let paid=0,result;if(v>21){result='LOSE'}else if(natural&&!dbj){paid=h.bet*2.5;result='BLACKJACK'}else if(dbj&&!natural){result='LOSE'}else if(dv>21||v>dv){paid=h.bet*2;result='WIN'}else if(v===dv||natural&&dbj){paid=h.bet;result='PUSH'}else result='LOSE';p.bank+=paid;h.paid=paid;h.result=result;p.stats.hands++;p.stats.net+=paid-h.bet;if(result==='PUSH')p.stats.push++;else if(result==='LOSE')p.stats.lost++;else {p.stats.won++;p.stats.biggest=Math.max(p.stats.biggest,paid-h.bet);if(p.bot&&Math.random()<.35)react(p.name,'win')}}
game.phase='ROUND_OVER';send()},1050)}
function end(){if(timer){clearTimeout(timer);timer=null}game.phase='GAME_OVER';game.stats=game.players.map(p=>({name:p.name,bank:p.bank,...p.stats})).sort((a,b)=>b.bank-a.bank);say('Dealer',rand(['That’s a wrap. Let’s see who leaves with the chips.','The table is closed. Time to count the damage.']));send()}
io.on('connection',socket=>{socket.emit('state',publicState());socket.on('setup',names=>{if(!Array.isArray(names)||names.length<2||names.length>3||names.some(n=>!NAMES.includes(n))||new Set(names).size!==names.length)return;setup(names)});
socket.on('join',name=>{let p=game.players.find(p=>p.name===name&&!p.bot);if(!p)return; if(p.socketId&&p.socketId!==socket.id){let old=io.sockets.sockets.get(p.socketId);if(old)old.emit('replaced')}p.socketId=socket.id;p.connected=true;socket.data.name=name;socket.emit('joined',name);send()});
socket.on('bet',({name,amount})=>{let p=game.players.find(p=>p.name===name&&!p.bot&&p.socketId===socket.id);if(!p||game.phase!=='BETTING'||p.bet>0)return;amount=Number(amount);if(!Number.isInteger(amount)||amount<10||amount>500||amount>p.bank)return;p.bet=amount;p.bank-=amount;send();if(canDeal())setTimeout(()=>{if(game.phase==='BETTING')deal()},450)});
socket.on('act',({name,type})=>{let p=game.players[game.turn];if(p&&p.name===name&&!p.bot&&p.socketId===socket.id&&['hit','stand','double','split'].includes(type))action(p,type)});
socket.on('next',()=>{if(game.phase==='ROUND_OVER')betting()});socket.on('end',()=>end());socket.on('reset',()=>{if(timer){clearTimeout(timer);timer=null}game=fresh();send()});socket.on('disconnect',()=>{let p=game.players.find(p=>p.socketId===socket.id);if(p){p.connected=false;p.socketId=null;send()}})});
server.listen(process.env.PORT||3000,()=>console.log('Margus Blackjack listening'));

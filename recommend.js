/* Football Coaching Planner – plan recommender
   Turns a plain-English description of a team's challenges into a progressive 6-week plan.

   How it works (no AI service, nothing leaves the browser):
     1. THEMES below lists coaching themes and the everyday phrases that point to each one.
     2. Each theme is matched to drills through the drill metadata: category, primary outcome,
        secondary outcomes, game moment, player decision and named drill codes.
     3. The top themes are spread over six weeks. Each theme moves through three stages –
        "Learn it" (little opposition), "Under pressure" and "In the game" – using each drill's
        opposition level and practice type, and the "recommended following drill" links.

   To teach it a new phrase, add it to the "say" list of the right theme.
*/
(function () {
  'use strict';

  var DRILLS = window.DRILLS || [];
  var byId = {};
  DRILLS.forEach(function (d) { byId[d.id] = d; });

  /* ---------- 1. Themes ---------- */
  // say:   phrases a coach might use (regular expressions, lower case)
  // cat:   drill categories that belong to the theme
  // skill: primary outcomes that belong to the theme
  // kw:    words to look for in secondary outcomes, game moment and player decision
  // ids:   drills that fit especially well
  var THEMES = [
    { id: 'space', label: 'Spreading out and using space',
      why: 'Players crowd the ball, so there is nobody to pass to and no space to play in.',
      say: [/bunch\w*/, /swarm\w*/, /bee ?hive/, /cluster\w*/, /crowd\w*/, /(all|everyone|everybody|they|whole team) (just )?(chas\w+|run\w*|follow\w*|go\w*|charg\w+)( to| after| towards)? the ball/,
            /spread\w* out/, /close together/, /on top of each other/, /same space/, /no shape/, /(use|using|find|finding|into) (the )?space/],
      soft: [/position\w*/, /\bshape\b/],
      cat: ['Positioning', 'Big Pitch'], skill: ['Support play', 'Creating space', 'Switching play'],
      kw: ['spacing', 'width', 'space', 'shape'], ids: ['POS-005', 'POS-001', 'BP-008', 'BP-009', 'POS-009'] },

    { id: 'scan', label: 'Looking up before the ball arrives',
      why: 'Players watch the ball and only look for options after they have controlled it.',
      say: [/(don'?t|not|never|rarely|doesn'?t|won'?t|nobody|no one) look\w* up/, /heads? (are |is )?down/, /ball[- ]watch\w*/, /scan\w*/, /awareness/, /\baware\b/, /check\w* (their |her |his |a |the |over )*shoulders?/, /shoulders?/,
            /don'?t know (what|who)('?s| is) (around|behind|near)/, /look\w* (around|up)/, /star\w+ at the ball/, /tunnel vision/, /(don'?t|can'?t|never) see\b/, /head up/],
      cat: ['Look, Receive, Play'], skill: ['Scanning', 'Awareness', 'Decision-making', 'Receiving under pressure'],
      kw: ['scanning', 'awareness', 'head-up', 'shoulder'], ids: ['REC-001'] },

    { id: 'touch', label: 'First touch and receiving',
      why: 'The first touch gets away, so possession is lost before anything else can happen.',
      say: [/first touch\w*/, /(heavy|poor|bad|loose|big) touch\w*/, /bounc\w+ off (them|her|him|their)/, /(can'?t|cannot|struggl\w+ to|unable to) (control|trap|receive)/,
            /control(ling)? (of )?the ball/, /trap\w*/, /(gets|runs|goes) away from (them|her|him)/],
      soft: [/receiv\w+/],
      cat: ['Receiving'], skill: ['First touch', 'Receiving', 'Receiving under pressure'],
      kw: ['first touch', 'receiving', 'back foot', 'half-turn'], ids: ['FB-002', 'FB-004', 'BM-002'] },

    { id: 'pass', label: 'Passing and keeping the ball',
      why: 'The ball is given away or kicked anywhere instead of being passed to a teammate.',
      say: [/\bpass(es|ing|ed)?\b/, /giv\w+ (it|the ball) away/, /keep\w* (the ball|possession|it)/, /possession/,
            /kick\w* (it )?(anywhere|away|and hope|it long|it as far)/, /\bboot\w*/, /hoof\w*/, /hot potato/, /composure/],
      soft: [/los\w+ (the ball|possession|it)\b/, /panic\w*/, /rush\w*/],
      cat: ['Combination Play', 'Big Pitch'], skill: ['Passing', 'Combination play', 'Playing forward', 'Support play'],
      kw: ['passing', 'possession', 'composure'], ids: ['FB-003', 'POS-002', 'BP-005'] },

    { id: 'move', label: 'Moving to help the player on the ball',
      why: 'Players pass and stand still, or hide, so the player on the ball has no options.',
      say: [/stand\w* still/, /(don'?t|not|never|doesn'?t) mov\w+/, /pass and (stand|watch)/, /(mov\w+|work\w*|run\w*|play) off the ball/, /\bhid(e|es|ing)\b/, /static/,
            /(don'?t|not|never) (want|ask|show|call|shout) for (it|the ball)/, /show\w* for (it|the ball)/, /support\w*/, /angles?\b/, /no options?/, /giv\w+ (an )?options?/,
            /watch\w* (the game|it happen)/, /movement/, /get\w* (free|open)/, /find\w* space/],
      cat: ['Positioning'], skill: ['Creating space', 'Support play'],
      kw: ['movement', 'support', 'angle', 'creating space'], ids: ['BP-005', 'POS-003', 'FB-006', 'FB-007', 'FB-009', 'POS-002'] },

    { id: 'dribble', label: 'Dribbling and taking players on',
      why: 'Players lack the close control or confidence to keep the ball and beat a defender.',
      say: [/dribbl\w*/, /tak\w+ (players|people|defenders|someone|anyone) on/, /beat\w* (a |the |their )?(player|defender|opponent)/, /run\w* with the ball/, /close control/,
            /ball mastery/, /confiden\w+ (on|with) the ball/, /comfortable (on|with) the ball/, /1 ?v ?1s? (attack\w*|going forward)/, /both feet|weak(er)? foot/],
      cat: ['Ball Mastery'], skill: ['Dribbling', 'Dribbling 1v1', 'Ball mastery', 'Turning', 'Sole-roll control'],
      kw: ['dribbling', 'ball mastery', 'change of direction', 'turns'], ids: ['WU-002', 'WU-003', 'WU-005', 'ADF-001', 'FB-001', 'FB-005'], warm: true },

    { id: 'shield', label: 'Protecting the ball and staying strong',
      why: 'Players are knocked off the ball too easily when a defender gets close.',
      say: [/shield\w*/, /(push|knock|muscl|shov|barg)\w+ off/, /bull(y|ied|ying)/, /protect\w* the ball/, /\b(strong|strength|stronger)\b/, /physical\w*/, /too nice/,
            /easily (tackled|dispossessed|pushed)/, /weak on the ball/, /hold\w* (it|the ball) up/],
      cat: ['Strength and Balance'], skill: ['Shielding', 'Balance under contact', 'Whole-body strength', 'Core stability', 'Acceleration strength'],
      kw: ['shielding', 'strength', 'contact', 'protect'], ids: ['FB-010', 'REC-005', 'STR-001', 'FB-012', 'LRP-005'], warm: true },

    { id: 'finish', label: 'Finishing and scoring',
      why: 'Chances are created but not turned into shots or goals.',
      say: [/finish\w*/, /shoot\w*/, /\bshots?\b/, /scor(e|es|ing)\b/, /in front of goal/, /chances?/, /goal[- ]?scoring/],
      cat: ['Finishing'], skill: ['Finishing'], kw: ['finishing', 'shooting'], ids: ['ADF-004'] },

    { id: 'def1', label: 'Defending 1v1',
      why: 'Defenders dive in, back off or let attackers run past them.',
      say: [/\bdefend(ing|s)?\b/, /\bdefen[cs]e\b/, /tackl\w*/, /div(e|es|ing) in/, /(get|gets|getting|got) beaten/, /(run|runs|running|go|goes|going|walk\w*|dribbl\w+) (straight |right )?past (us|them|her|him|our)/,
            /back\w* off/, /let\w* (them|players|attackers|opponents|the other team) (shoot|score|through|run\w*)/, /jockey\w*/, /clos\w+ (them |players |attackers )?down/, /stop\w* (the )?(attacker|player|other team)/],
      soft: [/win\w* the ball/],
      cat: ['Defending'], skill: ['Defending 1v1', 'Tackling', 'Delaying', 'Pressing'],
      kw: ['defending', 'delay', 'pressure', 'tackle'], ids: ['ADF-003', 'ADF-005', 'FB-011'] },

    { id: 'defteam', label: 'Defending together: cover, marking and shape',
      why: 'Defenders all go to the ball or leave attackers free, so one pass opens the team up.',
      say: [/\bcover(ing|s)?\b/, /compact\w*/, /\bgaps?\b/, /defensive (shape|line|unit|organisation)/, /\bmark(ing|s|ed)?\b/, /goal[- ]side/, /unmarked/,
            /(leave|leaving|left|leaves) (players|attackers|people|someone|girls|opponents) (free|open|alone)/, /out of position/, /huge (holes?|spaces?) at the back/, /nobody (stays|at the) back/],
      cat: [], skill: ['Defensive cover', 'Compactness', 'Marking', 'Protecting the goal'],
      kw: ['cover', 'compact', 'marking', 'goal side', 'balance'], ids: ['DEF-005', 'POS-007', 'SP-004', 'BB-004', 'POS-008'] },

    { id: 'trans', label: 'Reacting when the ball is won or lost',
      why: 'Players switch off at the moment possession changes instead of reacting straight away.',
      say: [/transition\w*/, /switch\w* off/, /(don'?t|not|never|slow to|won'?t) (track|get|run|come|work) back/, /track\w* back/, /recover\w*/, /\breact\w*/, /counter[- ]?attack\w*/,
            /(when|after|once) (we|they) (lose|lost|losing|win|won) (it|the ball|possession)/, /giv\w+ up/, /stop\w* (playing|running|trying)/, /win\w* (it|the ball) back/, /\bpress(ing|es|ed)?\b/, /heads? (go|goes|drop)/],
      cat: ['Transition'], skill: ['Transition to defend', 'Counter-attacking', 'Pressing', 'Reaction speed'],
      kw: ['transition', 'recover', 'react', 'press'], ids: ['POS-008', 'DEF-004'] },

    { id: 'bounce', label: 'Dealing with bouncing and high balls',
      why: 'Players wait for a bouncing ball or turn away from it, and the other team gets there first.',
      say: [/bouncing/, /bounc\w+ balls?/, /balls? bounc\w+/, /\bbounces?\b/, /high balls?/, /in the air/, /aerial/, /scared of the ball/, /afraid of the ball/, /\bduck\w*/, /turn\w* (their backs?|away)/,
            /let\w* (it|the ball) bounce/, /drop\w* balls?/, /clearances?/, /\bclear(ing)? (it|the ball)/, /long balls? over/],
      cat: ['Bouncing Ball'], skill: [], kw: ['bounce', 'bouncing', 'clear'], ids: [] },

    { id: 'corner', label: 'Corners', narrow: true,
      why: 'Corners are disorganised: players do not know their job when attacking or defending them.',
      say: [/corners?\b/], cat: [], weak: ['Set Pieces'], skill: [], kw: ['corner'], ids: ['SP-003', 'SP-004', 'SP-005', 'SP-008'], gk: true },
    { id: 'throw', label: 'Throw-ins and kick-ins', narrow: true,
      why: 'Possession is lost straight from throw-ins or kick-ins.',
      say: [/throw[- ]?ins?\b/, /kick[- ]?ins?\b/, /\bthrows\b/], cat: [], weak: ['Set Pieces'], skill: [], kw: ['throw-in'], ids: ['SP-002', 'SP-008', 'POS-003', 'FB-006'] },
    { id: 'freekick', label: 'Free kicks', narrow: true,
      why: 'Free kicks are wasted in attack or badly organised in defence.',
      say: [/free[- ]?kicks?\b/], cat: [], weak: ['Set Pieces'], skill: [], kw: ['free kick'], ids: ['SP-006', 'SP-007', 'SP-008'], gk: true },
    { id: 'buildout', label: 'Playing out from the goalkeeper',
      why: 'Goal kicks and restarts from the goalkeeper are lost, or simply kicked long.',
      say: [/goal[- ]?kicks?\b/, /play\w* out\b/, /(from|out of) the back/, /build[- ]?(up|out)/, /(keeper|goalkeeper|goalie) (just |always )?(kicks|boots|hoofs|launches|punts)/],
      cat: [], weak: ['Set Pieces'], skill: ['Building from the goalkeeper', 'Distribution', 'Goalkeeper decision-making'],
      kw: ['build', 'playing out', 'goal kick', 'goalkeeper'], ids: ['SP-001', 'POS-006', 'GK-003', 'BP-006', 'GK-004'], gk: true },
    { id: 'setpiece', label: 'Set pieces and restarts',
      why: 'Players wander at restarts instead of getting organised quickly.',
      say: [/set[- ]?pieces?/, /set plays?/, /restarts?/, /dead balls?/],
      cat: ['Set Pieces'], skill: [], kw: ['set piece'], ids: ['SP-008'], gk: true },

    { id: 'gk', label: 'Goalkeeping',
      why: 'Goalkeepers need work on handling, positioning and starting attacks.',
      say: [/goal ?keep\w*/, /\bkeepers?\b/, /goalies?\b/, /in goal\b/, /\bsav(e|es|ing)\b/, /handling/, /shot[- ]?stopp\w*/],
      cat: ['Goalkeeping'], skill: ['Ready position', 'Handling', 'Distribution', 'Shot stopping', 'Goalkeeper decision-making'],
      kw: ['goalkeeper'], ids: [], gk: true },

    { id: 'combine', label: 'Combining with a teammate',
      why: 'Players try to do everything alone instead of using a teammate to get past a defender.',
      say: [/one[- ]?twos?/, /wall pass\w*/, /give[- ]and[- ]gos?/, /overlap\w*/, /combin\w*/, /link\w* up/, /play\w* together/, /selfish/, /(won'?t|don'?t|never|doesn'?t|nobody|no one) pass\w*/,
            /on (her|his|their) own/, /team ?work/, /2 ?v ?1/, /greedy/, /share the ball/],
      cat: ['Combination Play'], skill: ['Combination play'], kw: ['combination', 'wall pass', 'overlap', '2v1'], ids: ['ADF-002', 'POS-009'] },

    { id: 'width', label: 'Using width and switching play',
      why: 'Everything goes through the crowded middle and the space out wide is ignored.',
      say: [/\bwidth\b/, /\bwide\b/, /\bwing\w*/, /switch\w* (play|the play|sides|it|the ball)/, /one side/, /(down|through) the middle/, /narrow/, /other side/],
      cat: [], skill: ['Switching play'], kw: ['width', 'switch', 'wide'], ids: ['BP-007', 'BP-010', 'BP-008', 'BP-009', 'POS-004', 'BB-007'] },

    { id: 'forward', label: 'Receiving on the half-turn and playing forward',
      why: 'Players receive facing their own goal and play backwards or lose the ball.',
      say: [/midfield\w*/, /play\w* forward/, /(get|getting|gets) (the ball|it) forward/, /through the lines/, /half[- ]turn/, /back to goal/, /facing (their|our|her|his) own goal/,
            /\bturning\b/, /(can'?t|cannot|don'?t) turn/, /turn\w* (with|on) the ball/, /play\w* backwards/],
      cat: ['Look, Receive, Play'], skill: ['Playing forward', 'Turning', 'Receiving under pressure'],
      kw: ['half-turn', 'forward', 'turning'], ids: ['REC-003', 'FB-005', 'BP-004', 'LRP-003'] },

    { id: 'talk', label: 'Talking and organising each other',
      why: 'The team is quiet, so players do not know who is going to the ball or who is free.',
      say: [/communicat\w*/, /(don'?t|not|never|won'?t|doesn'?t) (talk|speak|call|shout)/, /\bquiet\b/, /silent/, /talk\w*/, /call\w* for/, /organis\w+/],
      cat: [], skill: [], kw: ['communication', 'organisation', 'talk'], ids: ['BB-004', 'DEF-005', 'SP-007', 'SP-005', 'POS-006', 'BB-008'] },

    { id: 'decide', label: 'Making decisions on the ball',
      why: 'Players pick the first idea rather than the best option.',
      say: [/decision\w*/, /(when|whether) to (pass|dribble|shoot|turn)/, /wrong (option|choice|pass)/, /choos\w*/, /best option/],
      soft: [/think\w*/],
      cat: [], skill: ['Decision-making', 'Goalkeeper decision-making'], kw: ['decision'],
      ids: ['ADF-002', 'FIN-004', 'LRP-005', 'REC-005', 'SP-006', 'LRP-002', 'GK-004'] },

    { id: 'body', label: 'Balance, agility and co-ordination',
      why: 'Players lose their balance or are slow to change direction.',
      say: [/\bbalance\b/, /co-?ordination/, /agil\w*/, /fall\w* over/, /clumsy/, /landing/, /fitness/, /stamina/, /\btir(e|es|ed|ing)\b/, /\bspeed\b/, /accelerat\w*/, /change of direction/],
      cat: ['Strength and Balance', 'Warm-up and Physical Literacy'],
      skill: ['Single-leg balance', 'Agility and co-ordination', 'Landing control', 'Reactive balance', 'Reaction speed', 'Core stability', 'Single-leg landing control'],
      kw: ['balance', 'co-ordination', 'agility'], ids: [], warm: true },

    { id: 'long', label: 'Passing over distance',
      why: 'Players cannot move the ball far enough to switch play or clear danger.',
      say: [/long(er)? (pass\w*|balls?|kicks?)/, /(can'?t|cannot|don'?t) kick (it |the ball )?(far|long|hard)/, /kick\w* (it )?(far|further)/, /\bpower\b/, /lofted/, /range of pass\w*/],
      cat: ['Big Pitch'], skill: ['Passing', 'Switching play'], kw: ['long pass', 'distance'], ids: ['BP-001', 'BP-002', 'BP-003', 'BP-004'] },

    { id: 'basics', label: 'Getting the basics secure',
      why: 'Newer players need more touches on the core skills before adding pressure.',
      say: [/\bbasics?\b/, /fundamentals?/, /technique/, /new to (football|the game)/, /beginners?/, /just started/, /never played/],
      cat: ['Football Basics', 'Ball Mastery'], skill: ['Ball mastery', 'First touch', 'Passing', 'Dribbling'], kw: [], ids: ['WU-002'], warm: true }
  ];

  /* ---------- 2. Reading the description ---------- */

  var POSITIVE = /\b(good|great|strong|excellent|brilliant|fantastic|fine|solid|well|confident|love|loves|best)\b/;
  var NEGATIVE = /\b(not|cant|cannot|dont|doesnt|wont|isnt|arent|never|no|poor|bad|weak|struggle|struggles|struggling|lack|lacks|lose|loses|losing|lost|panic|scared|afraid|problem|problems|issue|issues|trouble|need|needs|improve|worse|worst|hard|difficult|rarely|too|but|unable|fail|fails|nobody|without)\b/;
  var EMPHASIS = /\b(biggest|main|major|worst|really|always|constantly|every time|all the time|most|mainly|especially|huge|massive|number one|priority)\b/;

  function analyse(text) {
    var clean = String(text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
    var clauses = clean.split(/[.;!?\n]|,| but | however | although | though | whereas | while /).map(function (c) { return c.trim(); }).filter(Boolean);
    var found = {}, strengths = {};
    clauses.forEach(function (clause, ci) {
      var bare = clause.replace(/'/g, '').replace(/no problems?/g, 'fine');
      var isStrength = POSITIVE.test(bare) && !NEGATIVE.test(bare);
      var boost = (EMPHASIS.test(clause) ? 1.3 : 1) * Math.max(0.7, 1.3 - ci * 0.08);
      var strongHits = [], softHits = [];
      THEMES.forEach(function (t) {
        // Longer, more specific phrases count for a little more than single words.
        t.say.forEach(function (re) { var m = clause.match(re); if (m) strongHits.push([t, m[0], 1, m[0].split(' ').length > 1 ? 1 : 0.8]); });
        (t.soft || []).forEach(function (re) { var m = clause.match(re); if (m) softHits.push([t, m[0], 0.5, 1]); });
      });
      // "let attackers shoot" is about defending, not shooting: a phrase inside a longer phrase is dropped.
      strongHits = strongHits.filter(function (h) {
        return !strongHits.some(function (o) { return o[0] !== h[0] && o[1].length > h[1].length && o[1].indexOf(h[1]) !== -1; });
      });
      strongHits.sort(function (x, y) { return y[1].length - x[1].length; });
      // Vague phrases ("lose the ball", "panic") only count when nothing more specific was said.
      (strongHits.length ? strongHits : softHits).forEach(function (h) {
        var bucket = isStrength ? strengths : found;
        var e = bucket[h[0].id] || (bucket[h[0].id] = { theme: h[0], weight: 0, evidence: [], strong: false });
        if (h[2] === 1) e.strong = true;
        var dup = e.evidence.some(function (x) { return x.indexOf(h[1]) !== -1 || h[1].indexOf(x) !== -1; });
        if (!dup) { e.evidence.push(h[1]); e.weight += boost * h[2] * h[3] * (e.evidence.length === 1 ? 1 : 0.35); }
      });
    });
    Object.keys(found).forEach(function (k) { if (!found[k].strong && strengths[k]) delete found[k]; });
    // A specific set piece beats the general "set pieces" theme.
    if (found.setpiece && (found.corner || found.throw || found.freekick || found.buildout)) delete found.setpiece;
    // "Goal kick" on its own should not also count as a goalkeeping theme.
    var themes = Object.keys(found).map(function (k) { return found[k]; }).sort(function (a, b) { return b.weight - a.weight; });
    var strong = Object.keys(strengths).filter(function (k) { return !found[k]; }).map(function (k) { return strengths[k]; });

    var hints = {};
    var pm = clean.match(/(\d{1,2}) (?:[a-z-]+ ){0,2}?(players|girls|boys|kids|children|of them|turn up|at training|in the squad)/);
    if (pm && +pm[1] >= 4 && +pm[1] <= 30) hints.players = +pm[1];
    var lm = clean.match(/(\d{2,3}) ?-? ?(min|minute)/);
    if (lm && +lm[1] >= 20 && +lm[1] <= 180) hints.length = +lm[1];
    else if (/hour and a half|1\.5 hours?|one and a half hours?/.test(clean)) hints.length = 90;
    else if (/\b(an|one|1) hour\b/.test(clean)) hints.length = 60;
    if (/\b(new|newer|beginners?|just started|inexperienced|first season|never played|nervous|shy)\b/.test(clean)) hints.gentle = true;
    return { themes: themes, strengths: strong, hints: hints, clean: clean };
  }

  /* ---------- 3. Matching drills through their metadata ---------- */

  function meta(d, label) {
    for (var i = 0; i < d.meta.length; i++) if (d.meta[i][0] === label) return d.meta[i][1];
    return '';
  }
  DRILLS.forEach(function (d) {
    d._meta = [d.name, d.skill, meta(d, 'Secondary outcomes'), meta(d, 'Game moment'), meta(d, 'Player decision')].join(' | ').toLowerCase();
    var opp = (meta(d, 'Opposition level') || meta(d, 'Opposition')).toLowerCase();
    var o = !opp ? 0 :
      /^unopposed/.test(opp) && !/progress/.test(opp) ? 1 :
      /unopposed|passive|walk-through|cone|mannequin|partner|shadow/.test(opp) ? 2 :
      /fully|team against team|4v4|2v2|3v3|within zones/.test(opp) ? 4 : 3;
    var g = { 'Warm-up & physical': 1, 'Technical': 1, 'Skill practice': 2, 'Opposed practice': 3, 'Game': 4 }[d.group] || 2;
    d._level = o ? (o + g) / 2 : g;   // 1 = no opposition ... 4 = full game
  });

  function has(list, value) {
    value = value.toLowerCase();
    for (var i = 0; i < list.length; i++) if (list[i].toLowerCase() === value) return true;
    return false;
  }
  // How well a drill fits a theme, and the reason to show the coach.
  function affinity(d, t) {
    var score = 0, why = '';
    if (t.ids.indexOf(d.id) !== -1) { score += 5; why = 'Picked for this theme'; }
    if (has(t.skill, d.skill)) { score += 4; why = 'Primary outcome: ' + d.skill; }
    if (has(t.cat, d.category)) { score += 4; if (!why) why = 'Category: ' + d.category; }
    if (t.weak && has(t.weak, d.category)) { score += 1; if (!why) why = 'Category: ' + d.category; }
    var hits = 0;
    t.kw.forEach(function (k) { if (hits < 3 && d._meta.indexOf(k) !== -1) { hits++; if (!why) why = 'Also develops: ' + k; } });
    score += hits;
    return { score: score, why: why };
  }

  /* ---------- 4. Building the six weeks ---------- */

  var STAGES = [
    { name: 'Learn it', target: 1.5, note: 'Lots of repetition with little or no opposition.' },
    { name: 'Under pressure', target: 2.75, note: 'The same idea with defenders and less time.' },
    { name: 'In the game', target: 3.6, note: 'Let the game test it; coach with questions rather than instructions.' }
  ];
  var WARM_CATS = ['Warm-up and Physical Literacy', 'Ball Mastery', 'Strength and Balance'];
  var GROUP_ORDER = ['Warm-up & physical', 'Technical', 'Skill practice', 'Opposed practice', 'Game'];

  // Small repeatable "shuffle" so that "Another version" gives a different but stable answer.
  function jitter(id, variant) {
    if (!variant) return 0;
    var h = variant * 7919;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100003;
    return (h % 1000) / 1000 * 6;
  }

  function weekLayout(n) {   // which theme (index) and stage each week gets; -1 = all themes together
    if (n === 1) return [[0, 0], [0, 0], [0, 1], [0, 1], [0, 2], [-1, 2]];
    if (n === 2) return [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [-1, 2]];
    return [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [-1, 2]];
  }

  function recommend(text, opts) {
    opts = opts || {};
    var a = analyse(text);
    // Numbers written in the description win over the boxes on the form.
    var players = a.hints.players || opts.players || 0;
    var length = a.hints.length || opts.length || 60;
    var variant = opts.variant || 0;
    if (!a.themes.length) {
      return { ok: false, strengths: a.strengths,
        message: 'I could not match that to anything in the drill library. Try describing what happens in matches, for example “they all chase the ball” or “we lose it from goal kicks”.' };
    }
    var chosen = a.themes.slice(0, 3), later = a.themes.slice(3);
    var themes = chosen.map(function (e) { return e.theme; });
    var allowGk = themes.some(function (t) { return t.gk; });
    var used = {}, lastByTheme = {}, weeks = [];

    function usable(d) {
      if (players && d.playersMin > players) return false;
      if (d.gk === 'Essential' && !allowGk) return false;
      return true;
    }
    var warmPool = DRILLS.filter(function (d) { return WARM_CATS.indexOf(d.category) !== -1 && d.id !== 'WU-001' && d.durMax <= 12 && d._level <= 2.5 && usable(d); });

    weekLayout(themes.length).forEach(function (slot, w) {
      var main = slot[0] === -1 ? themes : [themes[slot[0]]];
      var stage = STAGES[slot[1]];
      var target = stage.target - (a.hints.gentle ? 0.5 : 0);
      var picked = [], reasons = {}, minutes = 0, mainOnly = true, cur = main;
      var prev = main.length === 1 ? (lastByTheme[main[0].id] || []) : [];

      function rate(d) {
        var best = { score: 0, why: '' }, other = 0;
        themes.forEach(function (t) {
          var f = affinity(d, t);
          if (cur.indexOf(t) !== -1) { if (f.score > best.score) best = f; }
          else other = Math.max(other, f.score);
        });
        if (mainOnly && best.score <= 0) return null;
        var fit = best.score + 0.4 * other;
        if (fit <= 0) return null;
        var why = best.why || 'Supports the other themes in this plan';
        var s = fit * 3 + (4 - 2 * Math.abs(d._level - target)) * 4 + jitter(d.id, variant);
        var link = '';
        picked.concat(prev).forEach(function (id) {
          var p = byId[id];
          if (!link && (p.after.indexOf(d.id) !== -1 || d.before.indexOf(id) !== -1)) link = p.name;
        });
        if (link) { s += 3; why += ' · follows on from “' + link + '”'; }
        if (used[d.id]) s -= (d.group === 'Game' ? 30 : 18) * used[d.id];   // avoid repeating a drill unless nothing else fits
        return { d: d, s: s, why: why };
      }
      function best(pool) { return bestOf(pool, true) || bestOf(pool, false); }
      function bestOf(pool, onlyMain) {
        var top = null; mainOnly = onlyMain;
        pool.forEach(function (d) {
          if (picked.indexOf(d.id) !== -1 || !usable(d)) return;
          var r = rate(d);
          if (r && (!top || r.s > top.s)) top = r;
        });
        return top;
      }
      function take(r, why) {
        picked.push(r.d.id); reasons[r.d.id] = why || r.why; minutes += r.d.durMax; used[r.d.id] = (used[r.d.id] || 0) + 1;
      }

      // 1. Arrival activity, then a warm-up (one that suits the theme if there is one).
      if (byId['WU-001']) take({ d: byId['WU-001'] }, 'Arrival activity: everyone busy from the first minute');
      var freshWarm = warmPool.filter(function (d) { return !used[d.id]; });
      if (!freshWarm.length) freshWarm = warmPool;
      var warm = best(freshWarm);
      if (length >= 45) {   // short sessions go straight from the arrival activity to the practices
        if (warm && warm.why.indexOf('Supports') !== 0) take(warm, 'Warm-up · ' + warm.why);
        else if (freshWarm.length) take({ d: freshWarm[(w + variant) % freshWarm.length] }, 'Warm-up: balance, strength or ball mastery');
      }

      // 2. A game to finish (chosen now so there is always time left for it).
      var mainPool = DRILLS.filter(function (d) {
        return WARM_CATS.indexOf(d.category) === -1 || main.some(function (t) { return t.warm && affinity(d, t).score > 0; });
      });
      var game = best(mainPool.filter(function (d) { return d.group === 'Game'; }));
      if (!game || used[game.d.id]) {   // nothing new on the theme: finish with a different game instead of repeating one
        var anyGame = DRILLS.filter(function (d) { return d.group === 'Game' && usable(d) && d.durMax <= 15 && !used[d.id] && d.category !== 'Set Pieces'; });
        if (anyGame.length) game = { d: anyGame[(w + variant) % anyGame.length], why: 'look for this week’s focus in the game' };
      }
      var gameTime = game ? game.d.durMax : 0;

      // 3. Practices on the theme, building up through the session.
      var perGroup = {};
      function candidates(mustFit) {
        return mainPool.filter(function (d) {
          return (!game || d.id !== game.d.id) && (perGroup[d.group] || 0) < (d.group === 'Game' ? 1 : 2) &&
            (!mustFit || minutes + gameTime + d.durMax <= length);
        });
      }
      for (var n = 0; n < 6; n++) {
        if (slot[0] === -1) cur = [themes[n % themes.length]];   // final week: take turns between the themes
        // Always include one practice on the theme; after that only add what fits the session length.
        var r = best(candidates(true)) || (n === 0 ? best(candidates(false)) : null);
        if (!r) break;
        perGroup[r.d.group] = (perGroup[r.d.group] || 0) + 1;
        take(r);
      }
      cur = main;
      var headCount = length >= 45 ? 2 : 1;
      var head = picked.slice(0, headCount), body = picked.slice(headCount).sort(function (x, y) {
        return (GROUP_ORDER.indexOf(byId[x].group) - GROUP_ORDER.indexOf(byId[y].group)) || (byId[x]._level - byId[y]._level);
      });
      if (game) { body.push(game.d.id); reasons[game.d.id] = 'Game to finish · ' + game.why.replace(/^Game to finish ?·? ?/, ''); used[game.d.id] = (used[game.d.id] || 0) + 1; }
      reasons[body[body.length - 1]] = (reasons[body[body.length - 1]] || '').replace(/ · $/, '');
      var drills = head.concat(body);
      main.forEach(function (t) { lastByTheme[t.id] = body.slice(); });

      // The question to keep asking this week comes from the most relevant practice.
      var key = body.slice().sort(function (x, y) {
        return Math.max.apply(null, main.map(function (t) { return affinity(byId[y], t).score; })) -
               Math.max.apply(null, main.map(function (t) { return affinity(byId[x], t).score; }));
      })[0];
      var question = key ? meta(byId[key], 'Player decision') : '';
      var focus = main.length === 1 ? main[0].label + ' – ' + stage.name.toLowerCase() : 'Bring it together in games';
      var notes = (main.length === 1 ? main[0].why : 'Everything from the last five weeks, tested in games.') + ' ' + stage.note +
        (question ? ' Ask the players: “' + question + '”' : '');
      weeks.push({ focus: focus.slice(0, 80), notes: notes.slice(0, 600), drills: drills, reasons: reasons,
        theme: main.length === 1 ? main[0].label : 'All themes', stage: stage.name });
    });

    var title = 'Plan: ' + themes[0].label + (themes.length > 1 ? ' + ' + (themes.length - 1) + ' more' : '');
    return { ok: true, title: title.slice(0, 80), length: length, players: players,
      themes: chosen.map(function (e, i) {
        var layout = weekLayout(themes.length), wk = [];
        layout.forEach(function (s, w) { if (s[0] === i) wk.push(w + 1); });
        return { label: e.theme.label, why: e.theme.why, evidence: e.evidence, weeks: wk };
      }),
      later: later.map(function (e) { return { label: e.theme.label, evidence: e.evidence }; }),
      strengths: a.strengths.map(function (e) { return { label: e.theme.label, evidence: e.evidence }; }),
      gentle: !!a.hints.gentle, weeks: weeks };
  }

  window.Recommender = { recommend: recommend, analyse: analyse, THEMES: THEMES };
})();

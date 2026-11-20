# 書卷先知人物與牌卡補齊（2026-11-20）

## 使用者要求與範圍

- 使用者授權在 bible-scene 與 bible-quest 補齊第一批書卷先知，匯入提供的 11 張插畫，並將開發紀錄保存在專案 logs/。
- bible-scene 新增 13 位完整人物；bible-quest 沿用以賽亞 BQ-032、以西結 BQ-099，新增其餘 11 位。
- 沿用既有故事與進度格式；這次不新增 3D 故事、不部署、不上傳 R2、不提交 Git。
- 開始前已記錄兩個工作目錄的未提交變更。既有城池、地標、介面及音樂等變更保留。

## 新人物、卡號與篇章

| 人物 | ID | 牌卡 | 互動世界篇章 |
| --- | --- | --- | --- |
| 以賽亞 | isaiah | BQ-032（沿用） | 第五篇 |
| 以西結 | ezekiel | BQ-099（沿用） | 第六篇 |
| 何西阿 | hosea | BQ-174（SR） | 第五篇 |
| 約珥 | joel | BQ-175（SR） | 第六篇 |
| 阿摩司 | amos | BQ-176（SR） | 第五篇 |
| 俄巴底亞 | obadiah | BQ-177（SR） | 第六篇 |
| 彌迦 | micah | BQ-178（SR） | 第五篇 |
| 那鴻 | nahum | BQ-179（SR） | 第五篇 |
| 哈巴谷 | habakkuk | BQ-180（SR） | 第五篇 |
| 西番雅 | zephaniah | BQ-181（SR） | 第五篇 |
| 哈該 | haggai | BQ-182（SR） | 第六篇 |
| 撒迦利亞 | zechariahProphet | BQ-183（SR） | 第六篇 |
| 瑪拉基 | malachi | BQ-184（SR） | 第六篇 |

## 內容與身分處理

- 兩邊共用名稱、稱號、簡介與生平的中英文文案；既有以賽亞／以西結文案取自 bible-quest。
- 先知撒迦利亞為比利家的兒子、易多的孫子（亞 1:1），以 zechariahProphet 與施洗約翰的父親 zechariah 分開；BQ-036 保持原樣。
- 約珥、俄巴底亞年代未定，在互動世界 eraIds 留空，按主題放在第六篇；人物說明明示不指定確切年代。
- 俄巴底亞不等同亞哈家的家宰。使用者提供的插畫保留原樣；背景含古典柱廊岩壁建築，人物說明標示為主題藝術，不用作以東時期建築依據。
- 瑪拉基的家世與名字解讀不過度斷言。
- 新人物的 storyIds/eventIds 留空，由篇章人物區認識，認識後解鎖人物收藏卡。

## 經文依據

以經文為人物介紹依據；直接引用英文使用公有領域 KJV，中文沿用和合本用語。章節與節號使用專案原有 OSIS 書卷代碼，不改動既有經文代碼。

- 以賽亞：賽 1:1；6:1–8。
- 以西結：結 1:1–3；37:1–14。
- 何西阿：Hos 1:1–9；Hos 14:1–4。
- 約珥：Joel 1:1–14；Joel 2:12–13；Joel 2:28–32。
- 阿摩司：Amos 1:1；Amos 5:14–24；Amos 7:14–15。
- 俄巴底亞：Obad 1:1–4；Obad 1:10–21。
- 彌迦：Mic 1:1；Mic 5:2–4；Mic 6:6–8。
- 那鴻：Nah 1:1–7；Nah 3:1–7。
- 哈巴谷：Hab 1:1–4；Hab 2:1–4；Hab 3:17–19。
- 西番雅：Zeph 1:1–12；Zeph 2:3；Zeph 3:14–20。
- 哈該：Hag 1:1–15；Hag 2:1–9。
- 撒迦利亞：Zech 1:1–6；Zech 4:1–10；Zech 9:9。
- 瑪拉基：Mal 1:1–8；Mal 3:1–7；Mal 4:2。

核對來源：[小先知書首章](https://www.biblegateway.com/passage/?search=Hosea+1%2CJoel+1%2CAmos+1%2CObadiah%2CJonah+1%2CMicah+1%2CNahum+1%2CHabakkuk+1%2CZephaniah+1%2CHaggai+1%2CZechariah+1%2CMalachi+1&version=KJV)、[歸回先知與重建聖殿](https://www.biblegateway.com/passage/?search=Ezra+5%3A1-2%3BZechariah+4%3A6-10%3BMalachi+3%3A1&version=KJV)。

## 插畫來源與保存

原圖由使用者提供，從 Downloads 複製到兩邊 public/cards/<id>.jpg，不重繪、不裁切、不壓縮原檔。顯示時使用各自的 figure 座標裁切頭像／牌面。

新圖尚未同步到共用 R2，兩邊使用明確的本機路徑集合，避免設定遠端媒體網址時讀到不存在的圖片；舊圖仍走原有網址規則。bible-scene 的 .gitignore 只放行這 11 張新圖，其餘離線副本仍忽略。之後上傳 R2 再移除兩邊的本機集合。

| ID | 原始檔名 | SHA-256 |
| --- | --- | --- |
| hosea | gpt-image-2.5-flare_何西阿｜Hosea_Character_illustration_of_Hosea_the_biblical_prophet_portrayed-0.jpg | `7f1add6988572b30f54f75328a4ba63d76b8c17ef4310eb377202c08ddf930d2` |
| joel | gpt-image-2.5-flare_約珥｜Joel_Character_illustration_of_Joel_the_biblical_prophet_portrayed_as_a-0.jpg | `b24ad5d41574e9a84ba80cfef577f2ae995e2cb2486d58bf2973be88bf73754f` |
| amos | gpt-image-2.5-flare_阿摩司｜Amos_Character_illustration_of_Amos_the_biblical_prophet_and_shepher-0.jpg | `932a43fc169870d7fa78acc0240699df03e00ba05fbfd1a84cb4cbdd077ba9bb` |
| obadiah | gpt-image-2.5-flare_俄巴底亞｜Obadiah_Character_illustration_of_Obadiah_the_biblical_prophet_as-0.jpg | `4633e5c7fdc5137b984dcc224466ef8985c404aee00c8ae3eca033232ef1ab65` |
| micah | gpt-image-2.5-flare_彌迦｜Micah_Character_illustration_of_Micah_the_biblical_prophet_from_Moreshe-0.jpg | `182e72dc65dee583428474aeae30f25c0f5c9fc02a36a4848915b48f8f9dc8a4` |
| nahum | gpt-image-2.5-flare_那鴻｜Nahum_Character_illustration_of_Nahum_the_biblical_prophet_whose_messag-0.jpg | `acaecaefe095b16eefc322b9fb83a812cac801232c70122af366fc67b7fa4d1d` |
| habakkuk | gpt-image-2.5-flare_哈巴谷｜Habakkuk_Character_illustration_of_Habakkuk_the_biblical_prophet_ins-0.jpg | `4f0da03efab31003eaca594e8c26f0910feee276a1ea7c0e47cb55a566e6d182` |
| zephaniah | gpt-image-2.5-flare_西番雅｜Zephaniah_Character_illustration_of_Zephaniah_the_biblical_prophet_i-0.jpg | `14f288d210739daf587e9d20dc7e67a4b68db91d26d41a22a4f7716c41041b35` |
| haggai | gpt-image-2.5-flare_哈該｜Haggai_Character_illustration_of_Haggai_the_biblical_prophet_encouragin-0.jpg | `de63a22a114fb8ee9f738025f592a1dd797717aa3d00905ba95d442b04f73db8` |
| zechariahProphet | gpt-image-2.5-flare_撒迦利亞｜Zechariah，舊約先知_Character_illustration_of_Zechariah_the_-0.jpg | `0c4fb8a39efcdc19d37163ef79d98c40e688b05b39f33951887406b684e1a3d9` |
| malachi | gpt-image-2.5-flare_瑪拉基｜Malachi_Character_illustration_of_Malachi_the_biblical_prophet_calli-0.jpg | `a4fbb85efa33238d7b93c8a088cb173b9f9252b96bfa9862eff5794ca707b2f4` |

## 本專案修改

- game/v2/types.ts、data.ts：11 位角色型別、HP／元素／技能登錄；新卡均為 SR，HP 140–160，沿用原有稀有度區間。
- game/v2/engine.ts：22 個技能透過既有傷害、付費、目標、行動與複本規則運作；支援治療、護盾、信心及解除驚恐。不修改既有角色數值。
- game/i18n.ts、game/v2/i18n.ts、game/v3/i18n.ts、game/v3/stories.ts：中英文名字、技能、牌面、經文短句與生平。
- components/cards/CharacterCardFace.tsx、rarity.ts、timeline.ts：卡號、插畫、裁切、SR 稀有度與時代排序。
- pre-exilic 角色進 prophets 包；歸回及未定年角色按主題進 exile 包，每位可收藏人物恰好屬於一種補充包。
- game/assets.ts：11 張新圖先從本機提供；舊素材維持既有媒體網址規則。
- game/v2/prophets.test.ts、game/assets.test.ts：驗證登錄／中英文字／卡號唯一／取得方式，並對 22 技能逐一驗證 team、personal、table 三種模式與 #2 複本；另檢查能量不足不可施放、治療不復活、行動不可重複。

## 新技能設定

下列成本為 team 模式；table 模式將各角色的第二招改用藍色能量（與原有規則一致）。元素／技能是遊戲設計，不代表人物有對應自然力量。

| 人物 ID | 技能 ID | 技能名稱 | 類型／成本 | 效果 |
| --- | --- | --- | --- | --- |
| hosea | returnLord | 歸向耶和華 | guard／1 | 一名隊友、回復 HP 30、解除驚恐 |
| hosea | loveFreely | 甘心愛他們 | guard／2 | 所有隊友、回復 HP 20 |
| joel | rendHeart | 撕裂心腸 | guard／1 | 一名隊友、信心 1、解除驚恐 |
| joel | pourSpirit | 澆灌我的靈 | faith／2 | 所有隊友、護盾 20 |
| amos | seekGood | 求善不求惡 | attack／1 | 傷害 30 |
| amos | justiceWaters | 公義如江河 | faith／2 | 傷害 60 |
| obadiah | dayLord | 耶和華的日子 | attack／1 | 傷害 30 |
| obadiah | mountZion | 錫安的拯救 | guard／2 | 所有隊友、護盾 20 |
| micah | doJustly | 行公義 | attack／1 | 傷害 30 |
| micah | loveMercy | 好憐憫 | guard／2 | 一名隊友、回復 HP 40 |
| nahum | stormWay | 在風暴中的道路 | attack／1 | 傷害 30 |
| nahum | strongholdTrouble | 患難中的保障 | guard／2 | 所有隊友、護盾 20、解除驚恐 |
| habakkuk | watchAndWait | 站在守望所 | guard／1 | 一名隊友、信心 1 |
| habakkuk | rejoiceLord | 仍因主歡欣 | guard／2 | 所有隊友、回復 HP 20、解除驚恐 |
| zephaniah | seekMeekness | 尋求謙卑 | guard／1 | 一名隊友、護盾 30 |
| zephaniah | rejoiceSinging | 歡呼喜樂 | guard／2 | 所有隊友、回復 HP 20、解除驚恐 |
| haggai | considerWays | 省察道路 | guard／1 | 一名隊友、信心 1 |
| haggai | buildHouse | 建造這殿 | guard／2 | 所有隊友、護盾 20 |
| zechariahProphet | returnToMe | 你們要轉向我 | guard／1 | 一名隊友、回復 HP 30 |
| zechariahProphet | byMySpirit | 倚靠我的靈 | faith／2 | 所有隊友、護盾 30 |
| malachi | returnUntoMe | 回轉歸向我 | guard／1 | 一名隊友、信心 1、解除驚恐 |
| malachi | healingWings | 公義日頭的醫治 | guard／2 | 所有隊友、回復 HP 30 |

## 畫面檢查修正

- 人物介面的 messenger 會顯示「天使」，因此新增明確的 prophet 分類與「先知／Prophets」中英文標籤，新 13 位均使用此分類。
- 英文牌面長稱號會與 HP 擠在一起，將 11 位新角色的英文稱號縮短，並同步兩個專案；已重看瑪拉基英文牌面，標題與數值分開。
- CUA 實際確認 11 張新圖均載入成功；搜尋撒迦利亞可見兩位不同人物各自的圖片。

## 驗證結果

- `npm run typecheck`：通過。
- `npm run lint`：通過，0 errors、9 個原有 unused-vars warnings（BattleV3Screen、CampaignBattle、CampaignScreen、CharacterCardFace）。
- `npm test`：19 個測試檔、477 項測試全部通過；含新增的 68 項人物與技能測試。
- 新技能涵蓋 22 招 × team／personal／table 三模式、#2 複本施法、費用扣除、行動限制、傷害／治療／護盾／信心／解除驚恐；確認無資源不能施放、治療不會復活。
- 首輪全套測試發現每位角色需要藍色技能；已依既有 TABLE_BLUE 規則加入各角色第二招，並將彌迦的好憐憫定為 cost 2。pools.test.ts 與全套測試再次通過。
- CUA 逐一搜尋 11 位新人物，所有插畫 `complete=true` 且 `naturalWidth>0`；搜尋撒迦利亞同時顯示兩個不同圖片來源。結果保存在 `logs/prophets-qa-2026-11-20/art-load-checks.json`。
- CUA 實際檢視何西阿中文牌面與人物故事、瑪拉基英文牌面與人物故事；縮短英文稱號後確認不再擠到 HP。截圖在 `logs/prophets-qa-2026-11-20/`。
- 13 位共用人物的中英文文案與 scene 一致；兩專案匯入的 11 張 JPEG 與使用者原圖逐位元組相同。
- `git diff --check` 通過。
- 環境紀錄：啟動開發伺服器時，既有 Next.js 16.4.2 顯示安全升級提醒；本次沒有更動依賴或執行升級。測試用伺服器只監聽 127.0.0.1:3312，畫面驗證後已關閉。

## 完成狀態

本次授權範圍已完成。變更保留在工作目錄供檢閱，尚未 Git commit 或部署。新圖以本機檔提供，未上傳 R2。


## 後續：平衡檢查、R2 上傳（2026-11-20）

- 平衡檢查：22 個技能對照既有同類同費技能。阿摩司「公義如江河」（justiceWaters，信心、費 2）原為 60 傷害且無附加效果，高於既有同類同費上限 50（塞特 callOnLord、多馬 myLord），調為 50。其餘 21 個在既有區間內：一費攻擊 30（同大衛投石）、二費全隊治療 20–30（以利沙一費全隊治療 20）、護盾 20–30（約拿單 30）。
- 新增測試：先知傷害不得高於任何舊技能同類同費的最高值。
- R2：11 張圖以 rclone `--ignore-existing` 上傳到 r2:bible-quest/cards（上傳前確認 R2 無同名檔），公開網址皆 200、image/jpeg，ETag 與本機 md5 相符。
- 已移除 game/assets.ts 的 LOCAL_PROPHET_ART，新圖改走 NEXT_PUBLIC_ASSET_BASE；assets.test.ts 改為驗證走媒體主機。

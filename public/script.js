"use strict";

const roomIdButton = document.getElementById("roomIdButton");
const datesOnlyButton = document.getElementById("datesOnly");
const datesAndHoursButton = document.getElementById("datesAndHours");
const createButton = document.getElementById("createButton");
const calendarGrid = document.querySelector(".calendar-grid");
const currentMonthLabel = document.getElementById("currentMonth");
const saveButton = document.getElementById("saveButton");
const resetButton = document.getElementById("resetButton");
const showListButton = document.getElementById("showListButton");
const listModal = document.getElementById("listModal");
const memberList = document.getElementById("memberList");
const closeList = document.getElementById("closeListButton");
const selectedDatesGrid = document.getElementById("selectedDatesGrid");
const mask1 = document.getElementById("mask1"); // 一覧を表示のマスク
const timeInputModal = document.getElementById("timeInputModal");
const startHour = document.getElementById("startHour");
const startMinute = document.getElementById("startMinute");
const endHour = document.getElementById("endHour");
const endMinute = document.getElementById("endMinute");
const timeSaveButton = document.getElementById("timeSaveButton");
const timeCancelButton = document.getElementById("timeCancelButton");
const mask2 = document.getElementById("mask2"); // 時間帯選択のマスク
const drawHoursModal = document.getElementById("drawHoursModal");
const closeHours = document.getElementById("closeHoursButton");
const mask3 = document.getElementById("mask3"); // 時間帯キャンバスのマスク
const nicknameInputModal = document.getElementById("nicknameInputModal");
const nicknameInput = document.getElementById("nicknameInput");
const nicknameSaveButton = document.getElementById("nicknameSaveButton");
const nicknameCancelButton = document.getElementById("nicknameCancelButton");
const mask4 = document.getElementById("mask4"); // ニックネーム入力モーダルのマスク
const drawNicknamesModal = document.getElementById("drawNicknamesModal");
const nicknamesGrid = document.getElementById("nicknamesGrid");
const closeNicknamesButton = document.getElementById("closeNicknamesButton");
const mask5 = document.getElementById("mask5"); // ニックネーム表示モーダルのマスク

let roomId = null;
let drawOr = null;
let isDatesOnly = true; // モード選択
let selectedDates = {}; // 日付を保存
let selectedDatesWithNicknames = {}; // dbの全ての日付を保存
let isFirst = true;
let uniqueDatesSet = new Set(); // 重複を除外した日付
let savedAll = false; // 保存されたか
let isViewingMode = false; // 閲覧モードか
let isPrevMonthButtonLocked = false; // ロックフラグ
let currentDate = new Date();
let isAnimating = false;
let selectedDateKey = null;
let selectedDayDiv = null;
let ctx = null; // 時間帯表示キャンバス
let allNicknames = []; // 投票者リスト
let memberCount = 0; // 投票者数カウント

const showListKeyframes = {
    opacity: [0, 1],
};
const hideListKeyframes = {
    opacity: [1, 0],
};
const options = {
    duration: 400,
    easing: 'ease',
    fill: 'forwards',
};

document.addEventListener("DOMContentLoaded", () => {
    roomId = getRoomIdFromUrl();
    console.log("Callot ID: ", roomId);
    if (roomId === null) {
        document.getElementById("loading").style.display = "none";
        drawOr = document.getElementById("canvas-OR").getContext("2d"); // ORの表示キャンバス
        drawOr.strokeStyle = "gray";
        drawOr.beginPath();
        drawOr.moveTo(0, 10);
        drawOr.lineTo(140, 10);
        drawOr.stroke();
        drawOr.font = "15px 'cursive'";
        drawOr.fillStyle = "gray";
        drawOr.fillText('OR', 150, 15);
        drawOr.beginPath();
        drawOr.moveTo(180, 10);
        drawOr.lineTo(320, 10);
        drawOr.stroke();

        roomIdButton.addEventListener("click", () => {
            if (isAnimating) return; // すでにアニメーション中なら処理しない
            isAnimating = true;
            joinRoom();
        });

        datesOnlyButton.addEventListener("click", () => {
            datesOnlyButton.classList.add("abled");
            datesAndHoursButton.classList.remove("abled");
            isDatesOnly = true;
        });
        datesAndHoursButton.addEventListener("click", () => {
            datesAndHoursButton.classList.add("abled");
            datesOnlyButton.classList.remove("abled");
            isDatesOnly = false;
        });
        
        // 「作成」ボタン
        createButton.addEventListener("click", () => {
            if (isAnimating) return; // すでにアニメーション中なら処理しない
            isAnimating = true;
            const inputRoomName = document.getElementById("roomName").value.trim();
            if (!inputRoomName) {
                isAnimating = false;
                alert("題名を入力してください");
                return;
            }
            // roomId = generateRoomID();
            fetch('/api/create-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName: inputRoomName,
                    isDatesOnly: isDatesOnly
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    isAnimating = false;
                    window.location.href = `${window.location.origin}?room=${data.roomid}`;
                } else {
                    isAnimating = false;
                    alert('部屋の作成に失敗しました');
                }
            })
            .catch(error => {
                isAnimating = false;
                console.error('エラー:', error);
                alert('通信エラーが発生しました');
            });
        });
    } else {
        checkCallotId(roomId);
    }

    // Callot IDをクリックでコピー
    document.getElementById("showRoomId").addEventListener("click", () => {
        navigator.clipboard.writeText(roomId).then(() => {
            alert("コピーしました: " + roomId);
        }).catch((err) => {
            console.error("コピーに失敗:", err);
        });
    });

    // 閲覧モードのON/OFF
    document.getElementById("viewingButton").addEventListener("click", () => {
        document.getElementById("viewingButton").classList.toggle("checked"); // 文字の色切り替え
        document.querySelector(".calendar").classList.toggle("viewing"); // 周りの枠
        isViewingMode = !isViewingMode; // モード切り替え
        toggleSaveButtonState(); // 決定ボタンを無効に
        toggleResetButtonState(); // やり直すボタンを無効に

        document.querySelectorAll(".calendar-cell").forEach(dayDiv => {
            const dateText = dayDiv.querySelector(".date");
            if (!dateText) return;
            const day = dateText.textContent.trim();
            const yearMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            const dateKey = `${yearMonthKey}-${String(day).padStart(2, '0')}`;
            dayDiv.onclick = null; // 重複を防ぐ

            if (isViewingMode) { // ONのとき
                if (selectedDatesWithNicknames[dateKey]) {
                    if (selectedDates[yearMonthKey] && selectedDates[yearMonthKey][dateKey]) {
                        dayDiv.classList.add("finally-selected"); // 自分が選んだもの
                    } else {
                        dayDiv.classList.add("selectedAll"); // その他db含め選ばれた日付
                    }
                    dayDiv.style.pointerEvents = "auto";
                    dayDiv.classList.remove("calendar-cell-hover");
                    if (!isDatesOnly) {
                        dayDiv.onclick = () => {
                            drawHoursModal.style.visibility = "visible";
                            mask3.style.visibility = "visible";
                            drawHoursModal.animate(showListKeyframes, options);
                            mask3.animate(showListKeyframes, options);
                            drawHours(dateKey, selectedDatesWithNicknames);
                        };
                    } else {
                        dayDiv.onclick = () => {
                            drawNicknamesModal.style.visibility = "visible";
                            mask5.style.visibility = "visible";
                            drawNicknamesModal.animate(showListKeyframes, options);
                            mask5.animate(showListKeyframes, options);
                            drawNicknames(dateKey, selectedDatesWithNicknames);
                        };
                    }
                } else {
                    dayDiv.style.pointerEvents = "none"; // クリック無効化
                }
            } else { // 閲覧モードを解除した場合、選択状態をもとに戻す
                dayDiv.classList.remove("finally-selected", "selectedAll");
                dayDiv.classList.add("calendar-cell-hover");
                dayDiv.style.pointerEvents = "auto";
                if (isDatesOnly) {
                    dayDiv.onclick = () => {
                        if (selectedDates[yearMonthKey] && selectedDates[yearMonthKey][dateKey]) {
                            delete selectedDates[yearMonthKey][dateKey];
                            dayDiv.classList.remove("selected");
                            if (!selectedDatesWithNicknames[dateKey]) {
                                uniqueDatesSet.delete(dateKey);
                            }
                        } else {
                            if (uniqueDatesSet.size < 40 || (uniqueDatesSet.size === 40 && uniqueDatesSet.has(dateKey))) {
                                if (selectedDatesWithNicknames[dateKey] && selectedDatesWithNicknames[dateKey].length === 30) {
                                    alert("この日付にはすでに30人のニックネームが登録されています");
                                    return;
                                }
                                if (!selectedDates[yearMonthKey]) selectedDates[yearMonthKey] = {};
                                selectedDates[yearMonthKey][dateKey] = true;
                                dayDiv.classList.add("selected");
                                uniqueDatesSet.add(dateKey);
                            } else {
                                alert("最大選択日数は40日です");
                                return;
                            }
                        }
                        toggleSaveButtonState();
                    };
                } else {
                    dayDiv.onclick = () => {
                        if (uniqueDatesSet.size < 40 || (uniqueDatesSet.size === 40 && uniqueDatesSet.has(dateKey))) {
                            if (selectedDatesWithNicknames[dateKey] && selectedDatesWithNicknames[dateKey].length === 10) {
                                alert("この日付にはすでに10人のニックネームが登録されています");
                                return;
                            }
                            openTimeModal(dateKey, dayDiv);
                        } else {
                            alert("最大選択日数は40日です");
                            return;
                        }
                    };
                }
            }
        });
    });

    // 「決定」ボタン
    saveButton.addEventListener("click", (e) => {
        if (e.target.disabled) {
            e.preventDefault(); // イベントをキャンセルして処理を防ぐ
            return;
        }
        nicknameInputModal.style.visibility = "visible";
        mask4.style.visibility = "visible";
        nicknameInputModal.animate(showListKeyframes, options);
        mask4.animate(showListKeyframes, options);
        console.log("Selected Dates:", selectedDates);
    });

    // ニックネーム入力のテキストボックス
    nicknameInput.addEventListener("input", () => {
        const nickname = nicknameInput.value.trim();
        if (nickname.length > 0) { // 入力されたら保存可能に
            nicknameSaveButton.classList.add("abled");
            nicknameSaveButton.disabled = false;
        } else {
            nicknameSaveButton.classList.remove("abled");
            nicknameSaveButton.disabled = true;
        }
    });

    // ニックネーム入力モーダルの「保存」ボタン
    nicknameSaveButton.addEventListener("click", async (e) => {
        if (e.target.disabled) {
            e.preventDefault(); // イベントをキャンセルして処理を防ぐ
            return;
        }
        if (isAnimating) return; // すでにアニメーション中なら処理しない
        isAnimating = true;
        const nickname = nicknameInput.value.trim();
        if (nickname) {
            // ニックネームと時間帯を保存する処理
            try {
                const response = await fetch('/api/save-nickname', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nickname: nickname,
                        selectedDates: selectedDates,
                        roomId: roomId,
                        isDatesOnly: isDatesOnly
                    })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "保存に失敗しました");
                mask4.animate(hideListKeyframes, options);
                mask4.style.pointerEvents = "none";
                nicknameInputModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
                    mask4.style.pointerEvents = "auto";
                    isAnimating = false;
                    nicknameInputModal.style.visibility = "hidden";
                    mask4.style.visibility = "hidden";
                    saveButton.classList.remove("abled");
                };
                getAllNicknames(); // 新しく保存されたニックネームを保存
                savedAll = true;
                // 保存したら操作不可能に
                document.getElementById("viewingButton").classList.add("checked");
                document.getElementById("viewingButton").disabled = true;
                document.getElementById("viewingButton").style.pointerEvents = "none";
                document.querySelector(".calendar").classList.add("viewing"); // 周りの枠
                toggleSaveButtonState(); // 決定ボタンを無効に
                toggleResetButtonState(); // やり直すボタンを無効に
                await updateSelectedDatesWithNicknamesFromDB();
                updateCalendar();
                console.log("保存後の配列:", selectedDatesWithNicknames);
            } catch (err) {
                alert("保存に失敗しました: " + err.message);
            };
        } else {
            isAnimating = false;
            alert("ニックネームを入力してください");
        }
    });
    
    // ニックネーム入力モーダルの「キャンセル」ボタン
    nicknameCancelButton.addEventListener("click", () => {
        if (isAnimating) return; // すでにアニメーション中なら処理しない
        isAnimating = true;
        mask4.animate(hideListKeyframes, options);
        mask4.style.pointerEvents = "none";
        nicknameInputModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
            mask4.style.pointerEvents = "auto";
            isAnimating = false;
            nicknameInputModal.style.visibility = "hidden";
            mask4.style.visibility = "hidden";
        };
    });

    // ニックネーム入力モーダルのマスク
    mask4.addEventListener("click", () => {
        nicknameCancelButton.dispatchEvent(new PointerEvent("click"));
    });

    // ニックネーム表示モーダルの「閉じる」ボタン
    closeNicknamesButton.addEventListener("click", () => {
        if (isAnimating) return; // すでにアニメーション中なら処理しない
        isAnimating = true;
        mask5.animate(hideListKeyframes, options);
        mask5.style.pointerEvents = "none";
        drawNicknamesModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
            mask5.style.pointerEvents = "auto";
            isAnimating = false;
            drawNicknamesModal.style.visibility = "hidden";
            mask5.style.visibility = "hidden";
        };
    });

    // ニックネーム表示モーダルのマスク
    mask5.addEventListener("click", () => {
        closeNicknamesButton.dispatchEvent(new PointerEvent("click"));
    });

    // 「やり直す」ボタン
    resetButton.addEventListener("click", () => {
        savedAll = false;
        selectedDates = {};
        uniqueDatesSet = new Set();
        toggleSaveButtonState();
        document.querySelectorAll(".calendar-cell").forEach(cell => {
            cell.classList.remove("selected"); // 選択した日付をリセット
        });
        console.log("Selected Dates:", selectedDates);
    });

    // 「一覧を表示」ボタン
    showListButton.addEventListener("click", async () => {
        let count = 0;
        listModal.style.visibility = "visible";
        mask1.style.visibility = "visible";
        listModal.animate(showListKeyframes, options);
        mask1.animate(showListKeyframes, options);
        memberCount = allNicknames.length;
        memberList.textContent = `${memberCount}人が投票中`;
        selectedDatesGrid.textContent = ""; // モーダル内に保存した日付を表示

        // selectedDatesWithNicknamesのキーを昇順でソート
        const sortedDates = Object.keys(selectedDatesWithNicknames).sort((a, b) => {
            const [yearA, monthA, dayA] = a.split("-").map(Number);
            const [yearB, monthB, dayB] = b.split("-").map(Number);
            return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
        });

        if (sortedDates.length === 0) { // データがまだ何も保存されていない場合
            const noDataMessage = document.createElement("div");
            noDataMessage.textContent = "データが存在しません";
            noDataMessage.classList.add("no-data-message");
            selectedDatesGrid.appendChild(noDataMessage);
        } else {
            sortedDates.forEach(dateKey => { // ソートされた日付を表示
                count++;
                const dayDiv = document.createElement("div");
                dayDiv.classList.add("final-cell");
                const [year, month, day] = dateKey.split("-"); // dateKey を分割して月と日を取得
                if (count === 39) { // 38個目の後2マス開ける
                    for (let i = 0; i < 2; i++) {
                        const emptyDiv = document.createElement("div");
                        emptyDiv.textContent = "";
                        emptyDiv.classList.add("empty");
                        selectedDatesGrid.appendChild(emptyDiv); // emptyセルを挿入
                    }
                } 
                const dateText = document.createElement("span");
                dateText.textContent = `${parseInt(month)}/${parseInt(day)}`; // 日付を表示
                dateText.classList.add("date");
                dayDiv.appendChild(dateText);

                // ニックネームの個数を表示
                const nicknameCount = selectedDatesWithNicknames[dateKey] ? selectedDatesWithNicknames[dateKey].length : 0;
                const nicknameCountDiv = document.createElement("span");
                nicknameCountDiv.textContent = `(${nicknameCount})`; // ニックネームの個数を表示
                nicknameCountDiv.classList.add("nickname-count-list");
                dayDiv.appendChild(nicknameCountDiv);

                selectedDatesGrid.appendChild(dayDiv);

                if (!isDatesOnly) {
                    dayDiv.addEventListener("click", () => {
                        drawHoursModal.style.visibility = "visible";
                        mask3.style.visibility = "visible";
                        drawHoursModal.animate(showListKeyframes, options); // 時間帯キャンバスを表示
                        mask3.animate(showListKeyframes, options);
                        drawHours(dateKey, selectedDatesWithNicknames);
                    });
                } else {
                    dayDiv.addEventListener("click", () => {
                        drawNicknamesModal.style.visibility = "visible";
                        mask5.style.visibility = "visible";
                        drawNicknamesModal.animate(showListKeyframes, options); // ニックネーム表示キャンバスを表示
                        mask5.animate(showListKeyframes, options);
                        drawNicknames(dateKey, selectedDatesWithNicknames);
                    });
                }
            });
        }
        console.log("Sorted Dates:", sortedDates);
    });

    // 投票中の名前の表示モーダル
    memberList.addEventListener("click", () => {
        drawNicknamesModal.style.visibility = "visible";
        mask5.style.visibility = "visible";
        drawNicknamesModal.animate(showListKeyframes, options); // ニックネーム表示キャンバスを表示
        mask5.animate(showListKeyframes, options);
        const targetElement = document.getElementById("showDateInNicknames");
        targetElement.classList.add("font-kiwi");
        targetElement.textContent = `投票済み ${memberCount}`;

        nicknamesGrid.textContent = "";

        // 各ニックネームごとにセルを作成
        allNicknames.forEach(nickname => {
            const nicknameDiv = document.createElement("div");
            nicknameDiv.textContent = nickname; // ニックネームを表示
            nicknameDiv.classList.add("nickname-cell");
            nicknameDiv.classList.add("font-kiwi");
            nicknamesGrid.appendChild(nicknameDiv); // セルを追加
        });
    });

    // 一覧を表示の「閉じる」ボタン
    closeList.addEventListener("click", () => {
        if (isAnimating) return; // すでにアニメーション中なら処理しない
        isAnimating = true;
        mask1.animate(hideListKeyframes, options);
        mask1.style.pointerEvents = "none";
        listModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
            mask1.style.pointerEvents = "auto";
            isAnimating = false;
            listModal.style.visibility = "hidden";
            mask1.style.visibility = "hidden";
        };
    });

    // 一覧を表示のマスク
    mask1.addEventListener("click", () => {
        closeList.dispatchEvent(new PointerEvent("click"));
    });

    // 時間帯キャンバスの「閉じる」ボタン
    closeHours.addEventListener("click", () => {
        if (isAnimating) return;
        isAnimating = true;
        mask3.animate(hideListKeyframes, options);
        mask1.style.pointerEvents = "none";
        mask3.style.pointerEvents = "none";
        drawHoursModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
            mask1.style.pointerEvents = "auto";
            mask3.style.pointerEvents = "auto";
            isAnimating = false;
            drawHoursModal.style.visibility = "hidden";
            mask3.style.visibility = "hidden";
        };
    });

    // 時間帯キャンバスのマスク
    mask3.addEventListener("click", () => {
        closeHours.dispatchEvent(new PointerEvent("click"));
    });
    
    // 時間帯の「保存」ボタン
    timeSaveButton.addEventListener("click", (e) => {
        if (e.target.disabled) {
            e.preventDefault(); // イベントをキャンセルして処理を防ぐ
            return;
        }
        if (!selectedDateKey) return;
        if (isAnimating) return;
        isAnimating = true;

        let startH = parseInt(startHour.value, 10);
        let startM = parseInt(startMinute.value, 10);
        let endH = parseInt(endHour.value, 10);
        let endM = parseInt(endMinute.value, 10);

        // 時間の順序チェック
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;
        if (startTime >= endTime) {
            isAnimating = false;
            alert("終了時間は開始時間より後にしてください");
            return;
        }

        // フォーマットを2桁に統一（例: 9 → 09）
        let formattedStart = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
        let formattedEnd = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

        const [year, month, day] = selectedDateKey.split("-");
        const yearMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

        if (!selectedDates[yearMonthKey]) selectedDates[yearMonthKey] = {};
        selectedDates[yearMonthKey][selectedDateKey] = { start: formattedStart, end: formattedEnd };
        selectedDayDiv.classList.add("selected");
        toggleSaveButtonState();

        mask2.animate(hideListKeyframes, options);
        mask2.style.pointerEvents = "none";
        timeInputModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
            mask2.style.pointerEvents = "auto";
            isAnimating = false;
            timeInputModal.style.visibility = "hidden";
            mask2.style.visibility = "hidden";
            timeSaveButton.disabled = true;
            timeSaveButton.classList.remove("abled");
        };
        uniqueDatesSet.add(selectedDateKey);
        console.log("Selected Dates:", selectedDates);
    });

    // 時間帯の「取消」ボタン
    timeCancelButton.addEventListener("click", () => {
        if (isAnimating) return;
        isAnimating = true;
        mask2.animate(hideListKeyframes, options);
        mask2.style.pointerEvents = "none";
        timeInputModal.animate(hideListKeyframes, options).onfinish = () => { // アニメーション完了後にクリック許可
            mask2.style.pointerEvents = "auto";
            isAnimating = false;
            timeInputModal.style.visibility = "hidden";
            mask2.style.visibility = "hidden";
            timeSaveButton.disabled = true;
            timeSaveButton.classList.remove("abled");
        };
    });

    // 時間帯選択のマスク
    mask2.addEventListener("click", () => {
        timeCancelButton.dispatchEvent(new PointerEvent("click"));
    });

    // 月切り替えボタンの動作
    if (!isPrevMonthButtonLocked) document.getElementById("prevMonth").addEventListener("click", () => updateCalendar(-1));
    document.getElementById("nextMonth").addEventListener("click", () => updateCalendar(1));
});

// URLからCallot IDを取得    
function getRoomIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get("room");
    if (roomId) isDatesOnly = roomId.startsWith("D"); // 先頭文字が "D" なら true、"H" なら false
    return roomId;
}

// Callot IDが存在するかどうか確認
async function checkCallotId(roomIdFromUrl) {
    try {
        const response = await fetch(`/api/rooms/${roomIdFromUrl}/exists`);
        const data = await response.json();
        if (data.exists) {
            document.getElementById("title").style.display = "none";
            document.getElementById("mainPage").style.display = "block";
            initializeRoom(roomIdFromUrl);
        } else {
            alert("このページは存在しません。\nタイトルへ戻ります。");
            window.location.href = 'https://callot.onrender.com/';
        }
    } catch (error) {
        console.error("checkCallotId error:", error);
        alert("通信エラーが発生しました。");
    }
}

// DBから題名を取得して表示
async function getRoomName() {
    try {
        const response = await fetch(`/api/rooms/${roomId}/name`);
        const data = await response.json();
        if (data.roomName) {
            document.getElementById("showRoomName").textContent = data.roomName;
        }
    } catch (error) {
        console.error("roomName の取得に失敗しました:", error);
    }
}

// Callot IDを入力して参加
async function joinRoom() {
    const inputRoomId = document.getElementById("roomIdInput").value.trim();
    if (!inputRoomId) {
        isAnimating = false;
        alert("Callot IDを入力してください");
        return;
    }
    try {
        const response = await fetch(`/api/rooms/${inputRoomId}/exists`);
        const data = await response.json();
        if (data.exists) {
            isAnimating = false;
            window.location.href = `${window.location.origin}?room=${inputRoomId}`;
        } else {
            isAnimating = false;
            alert("Callot IDが存在しません");
        }
    } catch (error) {
        isAnimating = false;
        alert("通信エラーが発生しました。");
    }
}

// 参加後のページ移動
async function initializeRoom(roomId) {
    document.getElementById("showRoomId").textContent = `Callot ID: ${roomId}`; // Callot IDを表示

    await Promise.all([getRoomName(), updateCalendar(), getAllNicknames()]); // 3つの関数を並列で実行し、全てが完了するまで待つ
    isFirst = false;
    document.getElementById("loading").style.display = "none"; // すべて完了後にローディング画面を非表示

    memberCount = allNicknames.length;
    if (memberCount >= 30) { // 30人登録されていたら
        savedAll = true;
        document.getElementById("viewingButton").classList.add("checked");
        document.getElementById("viewingButton").disabled = true;
        document.getElementById("viewingButton").style.pointerEvents = "none";
        document.querySelector(".calendar").classList.add("viewing"); // 周りの枠
        toggleSaveButtonState(); // 決定ボタンを無効に
        toggleResetButtonState(); // やり直すボタンを無効に
        alert("30人の登録があるためこれ以上投票できません");
        document.querySelectorAll(".calendar-cell").forEach(dayDiv => {
            const dateText = dayDiv.querySelector(".date");
            if (!dateText) return;
            const day = dateText.textContent.trim();
            const yearMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            const dateKey = `${yearMonthKey}-${String(day).padStart(2, '0')}`;
            dayDiv.onclick = null; // 重複を防ぐ

            if (selectedDatesWithNicknames[dateKey]) {
                dayDiv.classList.add("selectedAll"); // その他db含め選ばれた日付
                dayDiv.style.pointerEvents = "auto";
                dayDiv.classList.remove("calendar-cell-hover");
                if (!isDatesOnly) {
                    dayDiv.onclick = () => {
                        drawHoursModal.style.visibility = "visible";
                        mask3.style.visibility = "visible";
                        drawHoursModal.animate(showListKeyframes, options);
                        mask3.animate(showListKeyframes, options);
                        drawHours(dateKey, selectedDatesWithNicknames);
                    };
                } else {
                    dayDiv.onclick = () => {
                        drawNicknamesModal.style.visibility = "visible";
                        mask5.style.visibility = "visible";
                        drawNicknamesModal.animate(showListKeyframes, options);
                        mask5.animate(showListKeyframes, options);
                        drawNicknames(dateKey, selectedDatesWithNicknames);
                    };
                }
            } else {
                dayDiv.style.pointerEvents = "none"; // クリック無効化
            }
        });
    }
    console.log("DB内の情報", selectedDatesWithNicknames);
}

// 投票中の全てのnicknameをdbから取得
async function getAllNicknames() {
    try {
        const response = await fetch(`/api/nicknames?roomId=${encodeURIComponent(roomId)}`);
        if (!response.ok) throw new Error("データの取得に失敗しました");

        const data = await response.json();
        allNicknames = data.nicknames || [];
    } catch (err) {
        console.error("ニックネーム取得エラー:", err);
        alert("ニックネームの取得に失敗しました");
    }
}

// DBに保存された日付とnicknameを配列に格納
async function updateSelectedDatesWithNicknamesFromDB() {
    try {
        const response = await fetch(`/api/selected-dates-with-nicknames?roomId=${roomId}&isDatesOnly=${isDatesOnly}`);
        if (!response.ok) throw new Error("取得に失敗しました");

        const data = await response.json();
        selectedDatesWithNicknames = data.selectedDatesWithNicknames; // 直接更新
        
        // uniqueDatesSet も更新
        Object.keys(selectedDatesWithNicknames).forEach(dateKey => {
            uniqueDatesSet.add(dateKey);
        });
    } catch (err) {
        console.error("DB取得エラー:", err);
        selectedDatesWithNicknames = {};
    }
}

// 月の表示を更新・作成
async function updateCalendar(monthOffset = 0) {
    if (isPrevMonthButtonLocked) return; // 連打でも過去に戻らないように
    isPrevMonthButtonLocked = true; // ボタンをロック
    if (isFirst) await updateSelectedDatesWithNicknamesFromDB();  // ロード時だけ更新を待ってから配列を保存
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() + monthOffset);
    currentMonthLabel.textContent = `${currentDate.getFullYear()}. ${currentDate.getMonth() + 1}`;

    // 過去の月に戻れなくする
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prevMonthButton = document.getElementById("prevMonth");
    if (currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear()) {
        prevMonthButton.classList.add("past");
        prevMonthButton.style.pointerEvents = "none";
    } else {
        prevMonthButton.classList.remove("past");
        prevMonthButton.style.pointerEvents = "auto";
    }

    calendarGrid.textContent = ""; // カレンダーの日付をクリア

    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay(); // 月の最初の日の曜日
    const yearMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // 1日目までの空白セル
    for (let i = 0; i < startDay; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.classList.add("empty");
        calendarGrid.appendChild(emptyCell);
    }

    // 日付を表示
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${yearMonthKey}-${String(day).padStart(2, '0')}`;
        const dayDiv = document.createElement("div");
        // dayDiv.textContent = day;
        dayDiv.classList.add("calendar-cell");
        dayDiv.classList.add("calendar-cell-hover");

        const dateText = document.createElement("span");
        dateText.textContent = day;
        dateText.classList.add("date");
        dayDiv.appendChild(dateText);

        // ニックネームの個数を表示
        const nicknameCount = selectedDatesWithNicknames[dateKey] ? selectedDatesWithNicknames[dateKey].length : 0;
        if (nicknameCount > 0) {
            const nicknameCountDiv = document.createElement("span");
            nicknameCountDiv.textContent = `(${nicknameCount})`; // ニックネームの個数を表示
            nicknameCountDiv.classList.add("nickname-count-calendar");
            dayDiv.appendChild(nicknameCountDiv);
        }

        if (selectedDates[yearMonthKey] && selectedDates[yearMonthKey][dateKey]) {
            dayDiv.classList.add("selected"); // 選択状態を復元
        }

        const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

        if (cellDate.getDay() === 0) { 
            dayDiv.classList.add("sun"); // 日曜日
        }

        if (cellDate < today) { // 過去の日付ならクリック無効化
            dayDiv.classList.add("past");
            dayDiv.style.pointerEvents = "none"; 
        } else {
            if (savedAll || isViewingMode) { // 保存後の状態で表示
                if (selectedDatesWithNicknames[dateKey]) { // db内にあればクリック可能
                    if (selectedDates[yearMonthKey] && selectedDates[yearMonthKey][dateKey]) {
                        dayDiv.classList.add("finally-selected"); // 自分が選んだもの
                    } else {
                        dayDiv.classList.add("selectedAll"); // その他db含め選ばれた日付全て
                    }
                    dayDiv.style.pointerEvents = "auto";
                    dayDiv.classList.remove("calendar-cell-hover"); // hoverイベントは無効
                    if (!isDatesOnly) {
                        dayDiv.onclick = () => {
                            drawHoursModal.style.visibility = "visible";
                            mask3.style.visibility = "visible";
                            drawHoursModal.animate(showListKeyframes, options); // 時間帯キャンバスを表示
                            mask3.animate(showListKeyframes, options);
                            drawHours(dateKey, selectedDatesWithNicknames);
                        };
                    } else {
                        dayDiv.onclick = () => {
                            drawNicknamesModal.style.visibility = "visible";
                            mask5.style.visibility = "visible";
                            drawNicknamesModal.animate(showListKeyframes, options); // ニックネーム表示キャンバスを表示
                            mask5.animate(showListKeyframes, options);
                            drawNicknames(dateKey, selectedDatesWithNicknames);
                        };
                    }
                } else {
                    dayDiv.style.pointerEvents = "none"; // 選ばれていないセルはクリック不可
                }
            } else if (isDatesOnly) {
                dayDiv.onclick = () => {
                    if (selectedDates[yearMonthKey] && selectedDates[yearMonthKey][dateKey]) {
                        // 既に選択されていたら削除
                        delete selectedDates[yearMonthKey][dateKey];
                        dayDiv.classList.remove("selected");
                        if (!selectedDatesWithNicknames[dateKey]) {
                            uniqueDatesSet.delete(dateKey); // Setから削除
                        }
                    } else {
                        // 新しく選択する
                        if (uniqueDatesSet.size < 40 || (uniqueDatesSet.size === 40 && uniqueDatesSet.has(dateKey))) {
                            if (selectedDatesWithNicknames[dateKey] && selectedDatesWithNicknames[dateKey].length === 30) { // 1日に登録可能な最大人数30人
                                alert("この日付にはすでに30人のニックネームが登録されています");
                                return;
                            }
                            if (!selectedDates[yearMonthKey]) selectedDates[yearMonthKey] = {};
                            selectedDates[yearMonthKey][dateKey] = true;
                            dayDiv.classList.add("selected");
                            uniqueDatesSet.add(dateKey); // Set に追加
                        } else { // 最大40日まで選択可能
                            alert("最大選択日数は40日です");
                            return;
                        }
                    }
                    toggleSaveButtonState();
                };
            } else if (!isDatesOnly) {
                dayDiv.onclick = () => {
                    if (uniqueDatesSet.size < 40 || (uniqueDatesSet.size === 40 && uniqueDatesSet.has(dateKey))) {
                        if (selectedDatesWithNicknames[dateKey] && selectedDatesWithNicknames[dateKey].length === 10) { // 1日に登録可能な最大人数10人
                            alert("この日付にはすでに10人のニックネームが登録されています");
                            return;
                        }
                        openTimeModal(dateKey, dayDiv); // 時間帯を選択
                    } else { // 最大40日まで選択可能
                        alert("最大選択日数は40日です");
                        return;
                    }
                };
            }
        }
        calendarGrid.appendChild(dayDiv);
    }

    // 空白セルを追加して6行になるようにする
    const totalCells = calendarGrid.children.length;
    const emptyCellsToFill = 42 - totalCells; // 6行×7列 = 42セルに合わせる
    for (let i = 0; i < emptyCellsToFill; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.classList.add("empty");
        calendarGrid.appendChild(emptyCell);
    }
    isPrevMonthButtonLocked = false; // ボタンロックを解除
}

// 「保存」ボタンの切り替え
function toggleSaveButtonState() {
    const hasSelectedDates = Object.values(selectedDates).some(month => Object.keys(month).length > 0);
    saveButton.disabled = (!hasSelectedDates || (hasSelectedDates && isViewingMode) || savedAll);
    if (!hasSelectedDates || (hasSelectedDates && isViewingMode) || savedAll) {
        saveButton.classList.remove("abled");
    } else {
        saveButton.classList.add("abled");
    }
}

// 「やり直す」ボタンの切り替え
function toggleResetButtonState() {
    resetButton.disabled = (savedAll || isViewingMode);
    if (savedAll || isViewingMode) {
        resetButton.classList.add("disabled");
    } else {
        resetButton.classList.remove("disabled");
    }
}

// 時間帯を設定
function openTimeModal(dateKey, dayDiv) {
    selectedDateKey = dateKey;
    selectedDayDiv = dayDiv;
    startHour.value = "";
    startMinute.value = "";
    endHour.value = "";
    endMinute.value = "";
    let isReady = false;

    [startHour, startMinute, endHour, endMinute].forEach(input => {
        input.addEventListener("change", () => {
            isReady = (startHour.value && startMinute.value && endHour.value && endMinute.value);
            timeSaveButton.disabled = !isReady; // 4項目入力されたら保存可能
            if (isReady) {
                timeSaveButton.classList.add("abled");
            } else {
                timeSaveButton.classList.remove("abled");
            }
        });
    });

    timeInputModal.style.visibility = "visible";
    mask2.style.visibility = "visible";
    timeInputModal.animate(showListKeyframes, options);
    mask2.animate(showListKeyframes, options);
}

// 保存した時間帯をキャンバスで描画
function drawHours(dateKey, selectedDatesWithNicknames) {
    printDates(dateKey, "showDateInHours") // 選択された日付を表示
    ctx = document.getElementById("canvas").getContext("2d");
    ctx.clearRect(0, 0, 365, 555);
    ctx.strokeStyle = "gray";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#fbd6ae"
    ctx.fillRect(30, 0, 330, 50); // nicknameの部分をハイライト
    ctx.beginPath();
    ctx.moveTo(30, 1);
    ctx.lineTo(360, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, 50);
    ctx.lineTo(360, 50);
    ctx.stroke();
    ctx.fillStyle = "black"
    ctx.font = "20px 'Pacifico'";
    let originY = 63; // 最初のY座標
    let space = 20; // 縦1目盛: 20
    for (let i = 0; i <= 24; i++) { // 横線(毎時)の描画
        if (i < 10) {
            ctx.fillText(i, 10, originY + 6);
        } else {
            ctx.fillText(i, 5, originY + 6);
        }
        ctx.beginPath();
        ctx.moveTo(30, originY);
        ctx.lineTo(360, originY);
        ctx.stroke();
        originY += space;
    }
    originY = 63;
    for (let i = 0; i <= 10; i++) { // 縦線の描画 (10人分)
        ctx.beginPath();
        ctx.moveTo(30 + i * 33, 0); // 横1目盛: 33
        ctx.lineTo(30 + i * 33, originY + space * 24);
        ctx.stroke();
    }
    ctx.fillStyle = "#fcdebd"
    ctx.fillRect(28, 51, 334, 11);

    // 指定された日付の全ユーザーの時間帯データを取得
    const userSchedules = selectedDatesWithNicknames[dateKey] || [];
    
    const colors = ["#189208", "#116b05"]; // 2種類の緑

    userSchedules.forEach((schedule, index) => {
        const { nickname, start, end } = schedule;

        const startHour = parseInt(start.split(":")[0]);
        const startMinute = parseInt(start.split(":")[1]);
        const endHour = parseInt(end.split(":")[0]);
        const endMinute = parseInt(end.split(":")[1]);

        let startY = ((startHour * 60 + startMinute) / 60) * space + originY;
        let endY = ((endHour * 60 + endMinute) / 60) * space + originY;
        let coordinateX;

        const userColor = colors[index % colors.length];
        ctx.strokeStyle = userColor;
        ctx.fillStyle = userColor;

        ctx.lineWidth = 31; // 33 - 1 * 2
        ctx.beginPath();
        coordinateX = 46.5 + (index * 33); // lineは中央の座標
        ctx.moveTo(coordinateX, startY);
        ctx.lineTo(coordinateX, endY);
        ctx.stroke(); // 1人分の描画
        let startX = coordinateX;
        let endX = coordinateX;
        if (startMinute < 10) startX += 3; // 1桁の場合
        if (endMinute < 10) endX += 3;
        ctx.fillStyle = "#fcdebd"
        ctx.font = "14px 'Pacifico'";
        let difMin = (endY - startY) / space * 60; // 開始時刻と終了時刻の差
        if (difMin < 90) { // 差が1時間未満の場合、分表示は外へ
            ctx.fillStyle = userColor;
            startY -= 14;
            endY += 14;
        }
        ctx.fillText(startMinute, startX - 7, startY + 12); // 分だけ表示
        ctx.fillText(endMinute, endX - 7, endY - 3); // 分だけ表示
        ctx.fillStyle = "black"
        ctx.font = "11px 'Kiwi Maru', serif";
        let coordinateY;
        const chunks = nickname.match(/.{1,3}/g); // 1～3文字ごとに分割
        if (chunks.length === 1) {
            coordinateY = 29.5;
        } else if (chunks.length === 2) {
            coordinateY = 22;
        } else if (chunks.length === 3) {
            coordinateY = 15;
        }
        chunks.forEach(text => {
            const textWidth = ctx.measureText(text).width;
            ctx.fillText(text, coordinateX - textWidth / 2, coordinateY); // ユーザー名を表示
            coordinateY += 15;
        });
    });
}

// 日付と曜日を表示
function printDates(dateKey, elementId) {
    const [year, month, day] = dateKey.split("-");
    const date = new Date(year, month - 1, day); // month は 0-indexed（1月=0, 2月=1,...）
    const dayOfWeek = date.getDay(); // 0:日曜, 1:月曜, ..., 6:土曜
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const targetElement = document.getElementById(elementId);
    targetElement.textContent = ""; // 既存の内容をクリア
    document.getElementById("showDateInNicknames").classList.remove("font-kiwi");
    const dateText = document.createTextNode(`${parseInt(month)}/${parseInt(day)} `); // 日付テキストを作成
    const dateSpan = document.createElement("span"); // 曜日 (span) を作成
    dateSpan.classList.add("font-MPlusRounded");
    dateSpan.textContent = `(${dayNames[dayOfWeek]})`;
    // 要素に追加
    targetElement.appendChild(dateText);
    targetElement.appendChild(dateSpan);
}

// 選択された日付にあるニックネームを表示
function drawNicknames(dateKey, selectedDatesWithNicknames) {
    printDates(dateKey, "showDateInNicknames") // 選択された日付を表示
    nicknamesGrid.textContent = "";
    // selectedDatesWithNicknamesからその日付のニックネーム配列を取得
    const nicknames = selectedDatesWithNicknames[dateKey];

    // 各ニックネームごとにセルを作成
    nicknames.forEach(nickname => {
        const dayDiv = document.createElement("div");
        dayDiv.textContent = nickname; // ニックネームを表示
        dayDiv.classList.add("nickname-cell");
        dayDiv.classList.add("font-kiwi");
        nicknamesGrid.appendChild(dayDiv); // セルを追加
    });
}
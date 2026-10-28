/**
 * The English words only a part reads, which the script bundle carries in that part instead of the main script
 * (tools/script-bundle.mjs). The packages keep every word in their tables — `MESSAGES`, `WIDGET_LABELS`,
 * `VIEWER_LABELS` hold every key in @fieldia/* as published — and only the one-tag script's build cuts: its main
 * script's English tables leave out the words named here, each part's script carries its own, and when a part comes it
 * puts them in every language's table where that table has no such word yet (`partWords`, add-language.ts in
 * @fieldia/viewer). An add-on's words are a whole language's, so an Arabic page has its Arabic whichever came first.
 *
 * A word is named here only where no module of the main script reads it — the main script may draw it before any part
 * has come — and named under every part whose modules read it, each of which may come without the others. The script
 * bundle refuses to build otherwise (`partWordsProblems`, on the modules its build put in each script), and
 * tools/part-words.test.mjs checks it on the module graph and that every word only parts read is named here.
 *
 * A module reads a word where its code names the key anywhere — as a property, a string, a type — its comments aside.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/** The packages' tables of words, named as `addLanguage` names a language's three: each one's file. */
export const WORD_TABLES = {
  messages: 'libs/core/src/lib/record/messages.ts',
  widgets: 'libs/widgets/src/lib/labels.ts',
  viewer: 'libs/viewer/src/lib/labels.ts',
};

/** By part, the keys of each table only that part's modules (and the other parts named with a key) read. */
export const PART_WORDS = {
  // A step's web address refused, a dialog's Save & Close, Search more…'s empty list (with the other lists that say so),
  // and a save over someone else's: who and when, what each changed, Reload's words, the changes set aside to put back,
  // their version unread.
  acts: {
    messages: ['addressRefused', 'theirsUnread'],
    widgets: ['noResults'],
    viewer: ['saveClose', 'conflictAt', 'conflictAtNoun', 'conflictChanged', 'conflictBoth', 'conflictChoice', 'reloaded', 'reloadedNoun', 'putBackField', 'putAllBack', 'nowIs'],
  },
  approvals: {
    messages: ['approvalLocked', 'approvalReasonNeeded', 'approvalNotYours'],
    viewer: [
      'approvalWaiting', 'approvalWho', 'approvalNeeded', 'approvalThen', 'approvalApproved', 'approvalRejectedBy', 'approvalRejected', 'approvalFailed', 'approvalOpen', 'approvalLockedAll', 'approvalLevelApproved', 'approvalLevelRejected',
      'approvalLevelWaiting', 'approvalLevelWaitingSome', 'approvalLevelLater', 'approvalLevelSkipped', 'approvalApprove', 'approvalReject', 'approvalApproveFor', 'approvalRejectFor', 'approvalApproving', 'approvalRejecting', 'approvalApprovedFor', 'approvalRejectedFor',
      'approvalApproveFailed', 'approvalRejectFailed', 'approvalRejectTitle', 'approvalRejectTitleNoun', 'approvalRejectAsk', 'approvalRejectReason', 'approvalKeepEditing', 'approvalHistoryCount', 'approvalAskedEntry', 'approvalApprovedEntry', 'approvalRejectedEntry', 'approvalChangedEntry', 'approvalNotNeeded',
    ],
  },
  assist: {
    viewer: [
      'assistFill', 'assistFillHint', 'assistFillBox', 'assistFillPlaceholder', 'assistFiles', 'assistFillGo', 'assistFillEmpty', 'assistFillEmptyText', 'assistFillEmptyFiles', 'assistKeepEditing', 'assistReading', 'assistFailed', 'assistNothing', 'assistProposed', 'assistProposedOne',
      'assistReview', 'assistAcceptAll', 'assistRejectAll', 'assistAccept', 'assistReject', 'assistProposal', 'assistProposedText', 'assistProposedIn', 'assistInPlaceOf', 'assistEmpty', 'assistLines', 'assistLinesOne',
      'assistKept', 'assistKeptAll', 'assistKeptAllOne', 'assistUndo', 'assistUndone', 'assistLeftTyped', 'assistNotUsed', 'assistOutOfSight', 'assistNoneCalled', 'assistSeveralCalled',
      'assistNotOffered', 'assistNotRead', 'assistDraft', 'assistPolish', 'assistWriting', 'assistRewriteFailed', 'assistWordsReading', 'assistWordsMade',
      'assistWordsNone', 'assistWordsFailed',
    ],
  },
  business: {
    widgets: ['moreSteps', 'timeInStep', 'copyValue', 'addAccount', 'sharesOff', 'untaxed', 'amountDue', 'paymentOf', 'openPayment', 'hoursDecimal', 'account', 'deleteLine', 'stillHolds'],
  },
  choice: { widgets: ['createNamed', 'stillHolds', 'noResults'] },
  columns: { widgets: ['movedTo'], viewer: ['moveColumnUp', 'moveColumnDown', 'resetColumns', 'resizeColumn'] },
  date: { widgets: ['chooseDate', 'weekShort', 'notPastedDate', 'previousMonth', 'nextMonth'] },
  duplicates: {
    viewer: [
      'duplicateWith', 'duplicateNamed', 'duplicateNamedWith', 'duplicateAnd', 'duplicatesMore', 'openDuplicate', 'notDuplicate', 'mergeDuplicate', 'mergeTitle', 'mergeIntro', 'mergeKeep', 'mergeShown', 'mergeEmpty', 'mergeSame', 'mergeAllSame', 'mergeWhat', 'merging', 'mergeUnread',
      'duplicateWithNoun', 'duplicateNamedNoun', 'duplicateNamedWithNoun', 'notDuplicateNoun', 'mergeTitleNoun', 'mergeIntroNoun', 'mergeShownNoun',
    ],
  },
  files: {
    widgets: [
      'uploadImage', 'dropHere', 'addFiles', 'addPhotos', 'dropThem', 'upToSize', 'upToEach', 'upToFiles', 'fileCount', 'oneFile', 'fileCountOf', 'tooMany', 'alreadyAdded', 'fileAt', 'noPreview', 'notAPicture', 'cannotPlay', 'recordVoice', 'recordVideo', 'recordVoiceUpTo', 'recordVideoUpTo', 'recorderNoPart', 'showFilesAs', 'asList', 'asCards', 'asThumbnails',
      'signaturePad', 'signHere', 'typeSignature', 'clearDrawing', 'uploadSignature', 'uploadPercent', 'uploadWaiting', 'uploadPreparing', 'uploadFailed', 'uploadRefused', 'uploadingNamed', 'retryUploadNamed', 'fileUploaded', 'filesUploaded', 'notUploadedNamed', 'noDocument',
      'removeAsk', 'removeFile', 'removed', 'notSignedNoPart', 'signingNoPart', 'signingRetry', 'notSignedReload', 'signingNoPartReload',
    ],
    viewer: ['showAs'],
  },
  editable: { widgets: ['cellName'], viewer: ['rowEditHint', 'rowAdd', 'rowAddNoun', 'rowDrop', 'rowNotSaved', 'rowSaved', 'rowOpen', 'rowChange', 'rowCell', 'rowLocked', 'rowLockedNoun', 'pasteAsk', 'pasteAskChange', 'pasteAskAdd', 'pasteYes', 'pasteUndo', 'pasteUndone', 'rowsNotSaved', 'rowsNotSavedOne', 'rowsDrop', 'rowsPutBack'] },
  record: {
    widgets: [
      'recordVoice', 'recordVideo', 'recordAskMic', 'recordAskCamera', 'recordReady', 'recordStart', 'recordStop', 'recordingNow', 'recordStarting', 'recordNothing', 'recordStoppedAt', 'recordStoppedSize', 'recordDone', 'recordUse', 'recordAgain', 'recordDiscardAsk', 'recordDiscard', 'recordGoBack',
      'recordMicRefused', 'recordCameraRefused', 'recordNoMic', 'recordNoCamera', 'recordBusy', 'recordCannot', 'recordTryAgain', 'recordingNameVoice', 'recordingNameVideo',
    ],
  },
  codes: { widgets: ['qrCodeOf', 'qrCode', 'barcodeOf', 'qrTooLong', 'barcodeRefused'] },
  pins: {
    widgets: [
      'pinsHelp', 'pinsOn', 'pinsNoPicture', 'pinsNone', 'pinAt', 'pinTopLeft', 'pinTop', 'pinTopRight', 'pinLeft', 'pinCentre', 'pinRight', 'pinBottomLeft', 'pinBottom', 'pinBottomRight',
      'pinNamed', 'pinNamedNote', 'pinNote', 'pinNotePlaceholder', 'pinRemove', 'pinAdded', 'pinMoved', 'pinRemoved', 'pinsFull',
    ],
  },
  evidence: { widgets: ['signedByName', 'signedAt', 'answersAsSigned', 'answersChanged', 'changeAnswers', 'changeAnswersAsk', 'signatureTakenAway', 'notSignedYet', 'readyToSign', 'signNow'] },
  filters: { viewer: ['filterByKeyword', 'clearFilters', 'filterNamed', 'filterSettings', 'rangeAny', 'rangeOrMore', 'filtersOn', 'filtersClearAll', 'showResults', 'showResultsNoun', 'showResultsOne', 'showResultsNounOne', 'showResultsSome'] },
  head: {
    widgets: ['maximiseNamed', 'foldNamed', 'unfoldNamed'],
    viewer: ['restoreSize', 'titleCopied', 'optionsFor', 'updatedBy', 'copyTitle'],
  },
  import: {
    widgets: ['phoneCountry', 'phoneNeedsCountry', 'phoneNoCode', 'phoneShort', 'phoneLong', 'phoneStart'],
    viewer: [
      'importTitle', 'importDrop', 'importChoose', 'importHint', 'importReading', 'importCannotRead', 'importNotSheet', 'importOldExcel', 'importLocked', 'importDamaged', 'importNoRows', 'importNoUnzip', 'importTooLarge', 'importTooMany', 'importColumnLetter',
      'importFileRows', 'importFileRowsOne', 'importNoRowsUnder', 'importMisread', 'importSheet', 'importEncoding', 'importUnicode', 'importSeparator', 'importComma', 'importSemicolon', 'importTab', 'importBar', 'importColumn', 'importExample', 'importField', 'importLeaveOut', 'importLeftOut',
      'importNeeded', 'importMoved', 'importCheck', 'importCheckOne', 'importChecking', 'importReady', 'importReadyOne', 'importRefused', 'importRefusedOne', 'importMore', 'importMoreOne', 'importPreview', 'importNone', 'importStart', 'importStartOne',
      'importWhy', 'importFixName', 'importing', 'importStop', 'importKeepEditing', 'importNotMade', 'importNoneCalled', 'importSeveralCalled', 'importNotYesNo', 'importRow', 'importDownload', 'importFailed',
      'importStartNoun', 'importStartNounOne', 'importNotMadeNoun', 'importFailedNoun',
    ],
  },
  languages: { messages: ['languagesNeeded', 'languagesNeededQuestion'], widgets: ['languageSwitch', 'languageEmpty', 'languageNeeded', 'inLanguage'] },
  outbox: { viewer: ['outboxWaiting', 'outboxWaitingOne', 'outboxOffline', 'outboxSending', 'outboxSent', 'outboxSendNow', 'outboxRefused', 'outboxRetry', 'outboxDiscard', 'outboxDiscardAsk', 'outboxKeptTitle', 'outboxKeptWords', 'outboxPageTitle', 'outboxPageWords', 'outboxWaitingPage', 'outboxWaitingPageOne'] },
  pay: { viewer: ['payAmount', 'payBack', 'payCancel', 'payCancelling', 'payNothingSent', 'payWaiting', 'payPaid', 'payPaidReference', 'payAgain', 'payCancelled', 'payFailed', 'payFailedWhy', 'payNotStarted'] },
  verify: {
    messages: ['notVerified'],
    viewer: [
      'verifySend', 'verifySendBy', 'verifyBySms', 'verifyByWhatsapp', 'verifyByCall', 'verifyByEmail', 'verifySending', 'verifySent', 'verifySentBy', 'verifyWorksFor', 'verifyWorksForOne', 'verifyCodeName', 'verifyCheck', 'verifyChecking', 'verifyTypeCode', 'verifyWrong', 'verifyWrongOne', 'verifyWrongSome', 'verifyWrongNone', 'verifyExpired', 'verifyAgain', 'verifyAgainIn', 'verifyDone', 'verifyNotSent', 'verifyNotChecked',
    ],
  },
  limits: { messages: ['formOpens', 'formClosed', 'formFull', 'formSent', 'choiceFull', 'choiceFilled'], viewer: ['closedTyped', 'laterButton', 'laterSaving', 'laterSaved', 'laterLink', 'laterLinkName', 'laterCopy', 'laterCopied', 'laterAgain', 'laterBack', 'laterFailed', 'resumeMissing'] },
  lines: {
    widgets: [
      'addSection', 'addNote', 'openLine', 'chooseLine', 'chooseAllLines', 'linesChosen', 'addAnother', 'totalWaits', 'cellWaits', 'notPastedCells', 'cellName', 'cellOfHeading', 'notPastedWhy', 'pasteBeyondLines', 'pasteBeyondLinesOne', 'pasteAddedLines', 'pasteAddedLinesOne',
      'pastedCells', 'pastedCellsOne', 'pasteRowRefused', 'pasteNoMatch', 'pasteSeveralCalled', 'pasteNotLookedUp', 'deleteLine', 'moveUp', 'moveDown', 'movedTo', 'removeAsk', 'removeFile', 'removed',
    ],
  },
  list: {
    widgets: ['enterNumber', 'enterDate', 'enterValue', 'phoneCallNamed', 'phoneWhatsAppNamed'],
    viewer: [
      'previousPage', 'nextPage', 'selectAll', 'viewList', 'viewMap', 'viewBoth', 'viewGallery', 'rowActions', 'selectRecord', 'noRecords', 'selectAllMatching', 'selectingAll', 'selectedOf', 'selectAllFailed', 'showAs',
      'export', 'exportExcel', 'exportCsv', 'exportCurrency', 'exportAll', 'exportAllOne', 'exporting', 'exportCut', 'exportFailed', 'exported', 'exportedOne', 'printList', 'printing', 'printCut', 'printFailed', 'printFilters', 'printGroups', 'printCount', 'printCountOne', 'printedOn',
      'bulkTitle', 'bulkTitleOne', 'bulkField', 'bulkApply', 'bulkAsk', 'bulkAskOne', 'bulkSet', 'bulkClear', 'bulkProgress', 'bulkDone', 'bulkDoneOne', 'bulkSome', 'bulkWhy', 'bulkChangedSince',
      'importDone', 'importDoneOne', 'importStopped', 'importSome', 'importUndo', 'importUndoAsk', 'importUndoAskOne', 'importUndoing', 'importUndone', 'importUndoneOne', 'importUndoSome', 'importRow', 'importDownload', 'importFailed',
      'assistWords', 'assistWordsTitle', 'searchLabel', 'searchOptions', 'favourites', 'removeFacet', 'addCustomFilter', 'saveSearch', 'searchName', 'useByDefault', 'deleteFavourite', 'noFavourites',
      'opIs', 'opIsNot', 'opContains', 'opGreater', 'opLess', 'opBetween', 'opSet', 'opNotSet', 'opPeriod',
      'rangeFrom', 'rangeTo', 'rangeBetween', 'rangeOrMore', 'rangeUpTo', 'rangeSince', 'rangeUntil', 'rangeOrder', 'rangeOrderDate', 'periodChip', 'periodToday', 'periodYesterday', 'periodThisWeek', 'periodLastWeek', 'periodThisMonth', 'periodLastMonth', 'periodThisYear', 'periodLast7Days', 'periodLast30Days', 'periodOverdue',
      'groupByYear', 'groupByQuarter', 'groupByMonth', 'groupByWeek', 'groupByDay', 'groupWeek', 'groupQuarter', 'totalAvg', 'totalMin', 'totalMax', 'totalCount', 'totalMixed', 'totalMixedShort', 'loadMore', 'sortKeyUp', 'sortKeyDown', 'groupCount', 'groupCountOne', 'expandAll', 'collapseAll',
      'relatedAll', 'relatedAllOf', 'relatedNew', 'relatedNewOf', 'relatedUnsaved', 'relatedNone', 'relatedShown', 'paperHeld', 'paperHeldPrint', 'rowsKey', 'findInList',
      'rangeNoun', 'noRecordsNoun', 'selectAllMatchingNoun', 'selectAllFailedNoun', 'exportAllNoun', 'exportAllNounOne', 'exportCutNoun', 'exportFailedNoun', 'exportedNoun', 'exportedNounOne', 'printCutNoun', 'printFailedNoun',
      'printCountNoun', 'printCountNounOne', 'bulkTitleNoun', 'bulkTitleNounOne', 'bulkAskNoun', 'bulkAskNounOne', 'bulkDoneNoun', 'bulkDoneNounOne', 'bulkSomeNoun', 'importDoneNoun', 'importDoneNounOne', 'importStoppedNoun', 'importSomeNoun',
      'importFailedNoun', 'importUndoAskNoun', 'importUndoAskNounOne', 'importUndoneNoun', 'importUndoneNounOne', 'importUndoSomeNoun', 'relatedAllNoun', 'relatedNewNoun', 'relatedUnsavedNoun', 'relatedNoneNoun', 'relatedShownNoun', 'groupCountNoun', 'groupCountNounOne',
    ],
  },
  // The classic formatted text's toolbar (with the work item's editor, which reads some of them too).
  html: { widgets: ['formatting', 'textStyle', 'subheading', 'alignLeft', 'alignCenter', 'alignRight', 'applyLink', 'removeLink'] },
  path: { widgets: ['expandNamed', 'collapseNamed', 'stillHolds', 'treeSearch', 'treeChosen', 'treeChosenOne', 'noResults'] },
  photos: {
    widgets: [
      'photosMove', 'photosMoveCover', 'photosMoveTouch', 'photosMoveTouchCover', 'photoCover', 'makeCover', 'coverNow', 'editPhoto', 'photoCaption', 'captionPlaceholder', 'photoNamed', 'photoNamedCover', 'photoAt', 'photoAtStart', 'photoAlone', 'photoAloneStart', 'photoCoverAt', 'cropLetGoAsk', 'cropLetGo', 'cropKeepEditing', 'photoCount', 'photoCountOne', 'photoCountOf', 'upToPhotos',
      'photoUploaded', 'photosUploaded', 'photoChanged', 'photoChangedKept', 'originalBack', 'turnLeft', 'turnRight', 'cropShape', 'cropAny', 'cropArea', 'cropKeys', 'applyEdit', 'putBackOriginal', 'photoLoading', 'photoUnreadable', 'photoNotMade',
      'addPhotos', 'dropThem', 'upToEach', 'removeAsk', 'removeFile', 'removed', 'movedTo', 'uploadingNamed', 'retryUploadNamed', 'notUploadedNamed',
    ],
  },
  rows: { viewer: ['previousPage', 'nextPage', 'relatedNone', 'detailOf', 'detailTitle', 'rowMovedTo', 'rowMoveHint', 'rankNotKept', 'treeIn', 'loadMore'] },
  views: { viewer: ['saveSearch', 'searchName', 'useByDefault', 'deleteFavourite', 'noFavourites', 'viewShared', 'viewSharedBy', 'shareView', 'viewsFailed', 'viewNotSaved', 'viewNotDeleted', 'viewDeleteAsk'] },
  months: {
    widgets: [
      'chooseDate', 'notPastedDate', 'previousMonth', 'nextMonth',
      'monthShape', 'monthShapeYmd', 'yearShape', 'chooseMonth', 'chooseYear', 'previousYear', 'nextYear', 'earlierYears', 'laterYears', 'monthUnfinished', 'yearUnfinished', 'dayLeftOut', 'monthLeftOut', 'hijriLabel', 'hijriShape', 'hijriUnfinished',
    ],
  },
  typed: { widgets: ['maskDigit', 'maskLetter', 'maskEither', 'maskFull', 'maskShort', 'maskShortOne', 'codeDigits', 'codeCharacters', 'codeDigitOnly', 'codeLetterOrDigit', 'codeFull', 'codeFullCharacters', 'shorthandIs', 'shorthandOnly'] },
  phone: { widgets: ['phoneNoCountry', 'phoneFindCountry', 'phoneCountries', 'phoneNoCountryFound', 'phoneCall', 'phoneWhatsApp', 'phoneCountry', 'phoneNeedsCountry', 'phoneNoCode', 'phoneShort', 'phoneLong', 'phoneStart', 'phoneCallNamed', 'phoneWhatsAppNamed', 'phoneLetters'] },
  print: { viewer: ['printedOn'] },
  relations: { widgets: ['createAndEdit', 'addNamed', 'addTag', 'tagThere', 'tagsAtMost', 'noMatchCreate', 'createNamed', 'stillHolds', 'noResults'] },
  scan: {
    widgets: ['scanButton', 'scanInto', 'scanCountInto', 'scanTitle', 'scanStarting', 'scanAim', 'scanAimCount', 'scanTypeInstead', 'scanTypeCode', 'scanTypeCount', 'scanDone', 'scanLookingUp', 'scanNoneFound', 'scanSeveral', 'scanLookUpFailed', 'scanNoPart', 'scanRead', 'scanCounted', 'scanRefused', 'scanNoCamera', 'scanCameraBusy', 'scanUnavailable', 'scanNoReader'],
  },
  schedule: {
    widgets: [
      'repeatLabel', 'repeatNever', 'repeatKinds', 'repeatEveryLabel', 'repeatUnits', 'repeatUnitsMany', 'repeatOnDays', 'repeatMonthHow', 'repeatMonthDay', 'repeatNth', 'repeatWeekday', 'repeatEndsLabel', 'repeatEnds', 'repeatUntilDay', 'repeatCount', 'repeatSaidEveryN', 'repeatSaidDays', 'repeatSaidMonthDay', 'repeatSaidLastDay', 'repeatSaidNth', 'repeatSaidTimes', 'repeatSaidOnce', 'repeatSaidUntil', 'repeatOrdinals', 'repeatKept', 'repeatAtLeastOne', 'hoursOpenOn', 'hoursOpen', 'hoursClosed', 'hoursOpens', 'hoursCloses', 'hoursAddBreak', 'hoursRemove', 'hoursCopyAll', 'hoursCopied', 'hoursEndsFirst', 'hoursOverlap', 'hoursNoTime', 'hoursAllClosed', 'hoursDays',
    ],
  },
  live: { messages: ['deletedElsewhere', 'deletedBy', 'changedElsewhere', 'changedBy'], viewer: ['presentHere', 'presentEditing'] },
  undo: { messages: ['pressDone', 'pressArchived', 'pressUnarchived'], viewer: ['undoPress', 'pressUndone', 'undoneField', 'redoneField', 'nothingSinceSave'] },
  templates: { viewer: ['templatesButton', 'templatesStart', 'templateSave', 'templateName', 'templateKeeps', 'templateKeep', 'templateSaved', 'templateReplaced', 'templateReplaceAsk', 'templateReplace', 'templateUsed', 'templatesDelete', 'templatesChosen', 'templatesDeleteNow', 'templatesDeleted'] },
  // The attachment beside a sheet: its name, Open, Previous and Next.
  sheet: { viewer: ['attachment', 'openAttachment', 'previousAttachment', 'nextAttachment'] },
  slots: { widgets: ['slotsFinding', 'slotsFailed', 'slotsRetry', 'slotsFree', 'slotsFreeOne', 'slotsOpen', 'slotsFull', 'slotsClosed', 'slotsHoliday', 'slotsOn', 'slotsNoneOn', 'slotsPickDay', 'slotSpan', 'slotChosen', 'slotChecking', 'slotTaken', 'slotsZone', 'previousMonth', 'nextMonth'] },
  survey: {
    widgets: ['notAnswered', 'addressStreet', 'addressCity', 'addressLine2', 'addressRegion', 'addressPostcode', 'addressCountry', 'keepOrder', 'addProperty', 'propertyName', 'propertyType', 'propertyTypes', 'colourCode', 'colourCodeBox', 'noColour', 'rankTop', 'moveUp', 'moveDown', 'movedTo', 'removed'],
  },
  surveyflow: {
    viewer: ['quizTitle', 'quizScore', 'quizRight', 'quizWrong', 'quizNotAnswered', 'quizPoints', 'quizYourAnswer', 'quizRightAnswer', 'quizLater', 'reviewAnswers', 'reviewTitle', 'reviewEdit', 'reviewNotAnswered', 'backToReview', 'flowQuestionOf', 'flowPrevious', 'flowNext', 'flowOk', 'flowEnterHint', 'timeLimitTitle', 'timeLimitIntro', 'timeStart', 'timeLeft', 'stepTimeLeft', 'timeWarn', 'timeUpSent', 'timeUpLocked', 'stepTimeUp'],
  },
  text: {
    widgets: ['textColour', 'linkRecordNamed', 'moreTools', 'switchToMarkdown', 'switchToRich', 'markdownSupported', 'pasteOrSelect', 'editNamed', 'doneEditing', 'addLink', 'existingItem', 'newItem', 'formattingLost', 'cursorInLink', 'attachFile', 'switchAnyway', 'headingLevel',
      'noResults', 'formatting', 'applyLink', 'removeLink', 'tableTool', 'tableInsert', 'tableSize', 'tableRows', 'tableRowsOne', 'tableColumns', 'tableColumnsOne', 'tableColumn', 'tableRowAbove', 'tableRowBelow', 'tableColumnLeft', 'tableColumnRight', 'tableDeleteRow', 'tableDeleteColumn', 'tableHeaderRow', 'tableDelete', 'tableKeys', 'tableRowAdded', 'tableColumnAdded', 'tableRowDeleted', 'tableColumnDeleted', 'tableDeleted',
    ],
  },
};

/** The lines of a table's English (`const en: … = {` to `};`), each one key's: refused where one is not. */
function englishLines(source, file) {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^const en: \w+ = \{$/.test(line));
  const end = lines.findIndex((line, i) => i > start && line === '};');
  if (start < 0 || end < 0) throw new Error(`${file} has no English table (const en: … = { … };) where this reads it`);
  const keys = new Map();
  for (let i = start + 1; i < end; i++) {
    const entry = /^ {2}([A-Za-z0-9_]+): (['"`]).*\2,$/.exec(lines[i]);
    if (!entry) throw new Error(`${file}:${i + 1} is not one word on one line ("  key: 'words',"), which the script bundle needs to cut its part words`);
    keys.set(entry[1], i);
  }
  return { lines, start, end, keys };
}

/** A table's keys, in the order its English has them. */
export function englishKeys(source, file = 'the table') {
  return [...englishLines(source, file).keys.keys()];
}

/** A table's source without the English of `keys` (each one it must have), for the main script. */
export function withoutWords(source, keys, file = 'the table') {
  const { lines, keys: at } = englishLines(source, file);
  const cut = new Set();
  for (const key of keys) {
    if (!at.has(key)) throw new Error(`${file} has no English word "${key}" to leave out`);
    cut.add(at.get(key));
  }
  return lines.filter((_, i) => !cut.has(i)).join('\n');
}

/** Every name a module's code says — its identifiers and its strings, in values and in types — its comments aside. */
export function namesIn(source, file = 'module.ts') {
  const names = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node) || ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS));
  return names;
}

/**
 * A module's source as read for the words it names: a table's own file without its type and its English, which name
 * them all.
 */
export function readerSource(root, file) {
  const source = readFileSync(join(root, file), 'utf8');
  if (!Object.values(WORD_TABLES).includes(file)) return source;
  const { lines, start, end } = englishLines(source, file);
  const type = lines.findIndex((line) => /^export interface \w+ \{$/.test(line));
  const typeEnd = lines.findIndex((line, i) => i > type && line === '}');
  if (type < 0 || typeEnd < 0 || typeEnd > start) throw new Error(`${file} has no type of its words (export interface … { … }) before its English`);
  return [...lines.slice(0, type), ...lines.slice(typeEnd + 1, start), ...lines.slice(end + 1)].join('\n');
}

/**
 * What is wrong with `declared` (PART_WORDS) for the modules each script carries — `main`, the main script's files, and
 * `parts`, each part's own — as `read(file)` gives their code; and the words only parts read that it does not name
 * (`unnamed`: what the main script could leave out still). Files are paths from the workspace; a module that is no
 * TypeScript or JavaScript file (a table of names the build makes), or another project's (node_modules), is passed over.
 */
export function partWordsProblems({ main, parts, read, tables, declared = PART_WORDS }) {
  const problems = [];
  // Another project's code (a package a part carries: the decode part's ZXing) never reads Fieldia's tables, whatever
  // names it uses.
  const code = (file) => /\.[cm]?[jt]s$/.test(file) && !/\/locales\//.test(file) && !/(^|\/)node_modules\//.test(file);
  const names = new Map();
  const namesOf = (file) => {
    if (!names.has(file)) names.set(file, namesIn(read(file), file));
    return names.get(file);
  };
  const mainFiles = [...main].filter(code);
  const partOf = new Map();
  for (const [part, files] of Object.entries(parts)) for (const file of files.filter(code)) partOf.set(file, part);
  const unnamed = [];
  for (const [table, keys] of Object.entries(tables)) {
    const known = new Set(keys);
    const named = new Map();
    for (const [part, words] of Object.entries(declared)) {
      if (!(part in parts)) problems.push(`PART_WORDS names a part "${part}" that the script bundle does not have`);
      const own = words[table] ?? [];
      for (const [i, key] of own.entries()) {
        if (!known.has(key)) problems.push(`PART_WORDS.${part}.${table} names "${key}", which is no word of ${table}`);
        if (own.indexOf(key) !== i) problems.push(`PART_WORDS.${part}.${table} names "${key}" twice`);
        named.set(key, [...(named.get(key) ?? []), part]);
      }
      for (const other of Object.keys(words)) if (!(other in tables)) problems.push(`PART_WORDS.${part} names a table "${other}": the tables are ${Object.keys(tables).join(', ')}`);
    }
    for (const key of keys) {
      const inMain = mainFiles.filter((file) => namesOf(file).has(key));
      const byPart = new Map();
      for (const [file, part] of partOf) if (namesOf(file).has(key)) byPart.set(part, [...(byPart.get(part) ?? []), file]);
      const bringers = named.get(key) ?? [];
      if (!bringers.length) {
        if (!inMain.length && byPart.size) unnamed.push({ table, key, parts: [...byPart.keys()].sort() });
        continue;
      }
      const at = `${table}.${key}`;
      if (inMain.length) problems.push(`${at} is named under ${bringers.join(', ')} in PART_WORDS, but the main script reads it (${inMain.join(', ')}): a word the main script reads stays in it`);
      for (const [part, files] of byPart) if (!bringers.includes(part)) problems.push(`${at} is read by the ${part} part (${files.join(', ')}), which does not bring it: name it under ${part} in PART_WORDS too`);
      for (const part of bringers) if (!byPart.has(part)) problems.push(`${at} is named under ${part} in PART_WORDS, but no module of the ${part} part reads it`);
    }
  }
  return { problems, unnamed };
}

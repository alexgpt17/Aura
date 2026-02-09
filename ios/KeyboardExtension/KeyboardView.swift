import UIKit
import CoreImage

protocol KeyboardViewDelegate: AnyObject {
    func didTapKey(_ key: String)
    func didTapBackspace()
    func didTapReturn()
    func didTapSpace()
    func didTapShift()
    func didTapNumbers()
    func didTapLetters()
    func didTapSymbols()
    func didTapNextKeyboard()
    func didTapEmoji()
    func didTapPeriod()
    func getDocumentContextBeforeInput() -> String?
    func emojiPickerToggled(isShowing: Bool)
    /// Returns true if the next character should be auto-capitalized (sentence start, etc.)
    func shouldAutoCapitalize() -> Bool
    /// Plays the standard system keyboard click sound
    func playKeyClickSound()
}

/// iOS-style emoji picker view - matches iOS emoji keyboard exactly with horizontal paging
class EmojiPickerView: UIView {
    weak var delegate: KeyboardViewDelegate?
    
    private var collectionView: UICollectionView!
    private var searchBar: UISearchBar!
    private var backButton: UIButton!
    private var categoryBar: UIView!
    private var categoryButtons: [UIButton] = []
    private var emojiBackspaceButton: UIButton!
    private var frequentlyUsed: [String] = []
    
    // iOS emoji categories with SF Symbol names for category bar icons
    // Icons use outline style (matching iOS unselected state); filled variant used for selected
    private let emojiCategoriesData: [(name: String, symbolName: String, emojis: [String])] = [
        // Frequently Used (first section)
        (name: "Frequently Used", symbolName: "clock", emojis: []), // Will be populated dynamically
        // Smileys & People
        (name: "Smileys & People", symbolName: "face.smiling", emojis: [
            "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "😶‍🌫️", "😵", "😵‍💫", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"
        ]),
        // Animals & Nature
        (name: "Animals & Nature", symbolName: "pawprint", emojis: [
            "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🦣", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦬", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐈‍⬛", "🪶", "🐓", "🦃", "🦤", "🦚", "🦜", "🦢", "🦩", "🕊", "🐇", "🦝", "🦨", "🦡", "🦫", "🦦", "🦥", "🐁", "🐀", "🐿", "🦔", "🌲", "🌳", "🌴", "🌵", "🌶", "🌷", "🌺", "🌻", "🌼", "🌽", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🍄", "🌰", "🌱"
        ]),
        // Food & Drink
        (name: "Food & Drink", symbolName: "fork.knife", emojis: [
            "🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🥭", "🍎", "🍏", "🍐", "🍑", "🍒", "🍓", "🫐", "🥝", "🍅", "🫒", "🥥", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶", "🫑", "🥒", "🥬", "🥦", "🧄", "🧅", "🍄", "🥜", "🌰", "🍞", "🥐", "🥖", "🫓", "🥨", "🥯", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥡", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "🫖", "☕️", "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧉", "🍾", "🧊"
        ]),
        // Activity
        (name: "Activity", symbolName: "soccerball", emojis: [
            "⚽️", "🏀", "🏈", "⚾️", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🥅", "⛳️", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛷", "⛸", "🥌", "🎿", "⛷", "🏂", "🪂", "🏋️", "🤼", "🤸", "🤺", "⛹️", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖", "🏵", "🎗", "🎫", "🎟", "🎪", "🤹", "🎭", "🩰", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🎲", "♟️", "🎯", "🎳", "🎮", "🎰", "🧩"
        ]),
        // Travel & Places
        (name: "Travel & Places", symbolName: "car", emojis: [
            "🚗", "🚕", "🚙", "🚌", "🚎", "🏎", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🦯", "🦽", "🦼", "🛴", "🚲", "🛵", "🏍", "🛺", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🪂", "💺", "🚁", "🚟", "🚠", "🚡", "🛸", "🚀", "🛰", "💺", "🚤", "🛥", "🛳", "⛴", "🚢", "⚓️", "⛽️", "🚧", "🚦", "🚥", "🗺", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟", "🎡", "🎢", "🎠", "⛲️", "⛱", "🏖", "🏝", "🏜", "🌋", "⛰", "🏔", "🗻", "🏕", "⛺️", "🛖", "🏠", "🏡", "🏘", "🏚", "🏗", "🏭", "🏢", "🏬", "🏣", "🏤", "🏥", "🏦", "🏨", "🏪", "🏫", "🏩", "💒", "🏛", "⛪️", "🕌", "🕍", "🛕", "🕋", "⛩", "🛤", "🛣", "🗾", "🎑", "🏞", "🌅", "🌄", "🌠", "🎇", "🎆", "🌇", "🌆", "🏙", "🌃", "🌌", "🌉", "🌁"
        ]),
        // Objects
        (name: "Objects", symbolName: "lightbulb", emojis: [
            "⌚️", "📱", "📲", "💻", "⌨️", "🖥", "🖨", "🖱", "🖲", "🕹", "🗜", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽", "🎞", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙", "🎚", "🎛", "⏱", "⏲", "⏰", "🕰", "⌛️", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯", "🪔", "🧯", "🛢", "💸", "💵", "💴", "💶", "💷", "💰", "💳", "💎", "⚖️", "🪜", "🧰", "🪛", "🔧", "🔨", "⚒", "🛠", "⛏", "🪚", "🔩", "⚙️", "🪤", "🧱", "⛓", "🧲", "🔫", "💣", "🧨", "🪓", "🔪", "🗡", "⚔️", "🛡", "🚬", "⚰️", "🪦", "⚱️", "🏺", "🔮", "📿", "🧿", "💈", "⚗️", "🔭", "🔬", "🕳", "🩹", "🩺", "💊", "💉", "🩸", "🧬", "🦠", "🧫", "🧪", "🌡", "🧹", "🪠", "🧺", "🧻", "🚽", "🚿", "🛁", "🛀", "🧼", "🪥", "🪒", "🧽", "🪣", "🧴", "🛎", "🔑", "🗝", "🚪", "🪑", "🛋", "🛏", "🛌", "🧸", "🪆", "🖼", "🪞", "🪟", "🛍", "🛒", "🎁", "🎈", "🎏", "🎀", "🪄", "🪅", "🎊", "🎉", "🎎", "🏮", "🎐", "🧧", "✉️", "📩", "📨", "📧", "💌", "📥", "📤", "📦", "🏷", "🪧", "📪", "📫", "📬", "📭", "📮", "📯", "📜", "📃", "📄", "📑", "🧾", "📊", "📈", "📉", "🗒", "🗓", "📆", "📅", "🗑", "📇", "🗃", "🗳", "🗄", "📋", "📁", "📂", "🗂", "🗞", "📰", "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "📖", "🔖", "🧷", "🔗", "📎", "🖇", "📏", "📐", "✂️"
        ]),
        // Symbols
        (name: "Symbols", symbolName: "number", emojis: [
            "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈️", "♉️", "♊️", "♋️", "♌️", "♍️", "♎️", "♏️", "♐️", "♑️", "♒️", "♓️", "🆔", "⚛️", "🉑", "☢️", "☣️", "📴", "📳", "🈶", "🈚️", "🈸", "🈺", "🈷️", "✴️", "🆚", "💮", "🉐", "㊙️", "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️", "🅱️", "🆎", "🆑", "🅾️", "🆘", "❌", "⭕️", "🛑", "⛔️", "📛", "🚫", "💯", "💢", "♨️", "🚷", "🚯", "🚳", "🚱", "🔞", "📵", "🚭", "❗️", "❓", "❕", "❔", "‼️", "⁉️", "🔅", "🔆", "〽️", "⚠️", "🚸", "🔱", "⚜️", "🔰", "♻️", "✅", "🈯️", "💹", "❇️", "✳️", "❎", "🌐", "💠", "Ⓜ️", "🌀", "💤", "🏧", "🚾", "♿️", "🅿️", "🈳", "🈂️", "🛂", "🛃", "🛄", "🛅", "🚹", "🚺", "🚼", "🚻", "🚮", "🎦", "📶", "🈁", "🔣", "ℹ️", "🔤", "🔡", "🔠", "🆖", "🆗", "🆙", "🆒", "🆕", "🆓", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "🔢", "#️⃣", "*️⃣", "⏏️", "▶️", "⏸", "⏯", "⏹", "⏺", "⏭", "⏮", "⏩", "⏪", "⏫", "⏬", "◀️", "🔼", "🔽", "➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "↙️", "↖️", "↕️", "↔️", "↪️", "↩️", "⤴️", "⤵️", "🔀", "🔁", "🔂", "🔄", "🔃", "🎵", "🎶", "➕", "➖", "➗", "✖️", "♾", "💲", "💱", "™️", "©️", "®️", "〰️", "➰", "➿", "🔚", "🔙", "🔛", "🔜", "🔝", "✔️", "☑️", "🔘", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫️", "⚪️", "🟤", "🔶", "🔷", "🔸", "🔹", "🔺", "🔻", "💠", "🔘", "🔳", "🔲", "▪️", "▫️", "◾️", "◽️", "◼️", "◻️", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬛️", "⬜️", "🟫", "🔈", "🔇", "🔉", "🔊", "🔔", "🔕", "📣", "📢", "💬", "💭", "🗯", "♠️", "♣️", "♥️", "♦️", "🃏", "🎴", "🀄️", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚", "🕛", "🕜", "🕝", "🕞", "🕟", "🕠", "🕡", "🕢", "🕣", "🕤", "🕥", "🕦", "🕧"
        ]),
        // Flags
        (name: "Flags", symbolName: "flag", emojis: [
            "🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🏳️‍⚧️", "🇦🇫", "🇦🇽", "🇦🇱", "🇩🇿", "🇦🇸", "🇦🇩", "🇦🇴", "🇦🇮", "🇦🇶", "🇦🇬", "🇦🇷", "🇦🇲", "🇦🇼", "🇦🇺", "🇦🇹", "🇦🇿", "🇧🇸", "🇧🇭", "🇧🇩", "🇧🇧", "🇧🇾", "🇧🇪", "🇧🇿", "🇧🇯", "🇧🇲", "🇧🇹", "🇧🇴", "🇧🇦", "🇧🇼", "🇧🇷", "🇮🇴", "🇻🇬", "🇧🇳", "🇧🇬", "🇧🇫", "🇧🇮", "🇰🇭", "🇨🇲", "🇨🇦", "🇮🇶", "🇨🇻", "🇰🇾", "🇨🇫", "🇹🇩", "🇨🇱", "🇨🇳", "🇨🇽", "🇨🇨", "🇨🇴", "🇰🇲", "🇨🇬", "🇨🇩", "🇨🇰", "🇨🇷", "🇨🇮", "🇭🇷", "🇨🇺", "🇨🇼", "🇨🇾", "🇨🇿", "🇩🇰", "🇩🇯", "🇩🇲", "🇩🇴", "🇪🇨", "🇪🇬", "🇸🇻", "🇬🇶", "🇪🇷", "🇪🇪", "🇪🇹", "🇪🇺", "🇫🇰", "🇫🇴", "🇫🇯", "🇫🇮", "🇫🇷", "🇬🇫", "🇵🇫", "🇹🇫", "🇬🇦", "🇬🇲", "🇬🇪", "🇩🇪", "🇬🇭", "🇬🇮", "🇬🇷", "🇬🇱", "🇬🇩", "🇬🇵", "🇬🇺", "🇬🇹", "🇬🇬", "🇬🇳", "🇬🇼", "🇬🇾", "🇭🇹", "🇭🇳", "🇭🇰", "🇭🇺", "🇮🇸", "🇮🇳", "🇮🇩", "🇮🇷", "🇮🇶", "🇮🇪", "🇮🇲", "🇮🇱", "🇮🇹", "🇯🇲", "🇯🇵", "🇯🇪", "🇯🇴", "🇰🇿", "🇰🇪", "🇰🇮", "🇽🇰", "🇰🇼", "🇰🇬", "🇱🇦", "🇱🇻", "🇱🇧", "🇱🇸", "🇱🇷", "🇱🇾", "🇱🇮", "🇱🇹", "🇱🇺", "🇲🇴", "🇲🇰", "🇲🇬", "🇲🇼", "🇲🇾", "🇲🇻", "🇲🇱", "🇲🇹", "🇲🇭", "🇲🇶", "🇲🇷", "🇲🇺", "🇾🇹", "🇲🇽", "🇫🇲", "🇲🇩", "🇲🇨", "🇲🇳", "🇲🇪", "🇲🇸", "🇲🇦", "🇲🇿", "🇲🇲", "🇳🇦", "🇳🇷", "🇳🇵", "🇳🇱", "🇳🇨", "🇳🇿", "🇳🇮", "🇳🇪", "🇳🇬", "🇳🇺", "🇳🇫", "🇰🇵", "🇲🇵", "🇳🇴", "🇴🇲", "🇵🇰", "🇵🇼", "🇵🇸", "🇵🇦", "🇵🇬", "🇵🇾", "🇵🇪", "🇵🇭", "🇵🇳", "🇵🇱", "🇵🇹", "🇵🇷", "🇶🇦", "🇷🇪", "🇷🇴", "🇷🇺", "🇷🇼", "🇼🇸", "🇸🇲", "🇸🇦", "🇸🇳", "🇷🇸", "🇸🇨", "🇸🇱", "🇸🇬", "🇸🇽", "🇸🇰", "🇸🇮", "🇬🇸", "🇸🇧", "🇸🇴", "🇿🇦", "🇰🇷", "🇸🇸", "🇪🇸", "🇱🇰", "🇧🇱", "🇸🇭", "🇰🇳", "🇱🇨", "🇵🇲", "🇻🇨", "🇸🇩", "🇸🇷", "🇸🇿", "🇸🇪", "🇨🇭", "🇸🇾", "🇹🇼", "🇹🇯", "🇹🇿", "🇹🇭", "🇹🇱", "🇹🇬", "🇹🇰", "🇹🇴", "🇹🇹", "🇹🇳", "🇹🇷", "🇹🇲", "🇹🇨", "🇹🇻", "🇺🇬", "🇺🇦", "🇦🇪", "🇬🇧", "🇺🇸", "🇻🇮", "🇺🇾", "🇺🇿", "🇻🇺", "🇻🇦", "🇻🇪", "🇻🇳", "🇼🇫", "🇪🇭", "🇾🇪", "🇿🇲", "🇿🇼"
        ])
    ]
    
    private var themeBackground: UIColor = .systemBackground
    private var themeText: UIColor = .label
    private var currentSection = 0 // 0 = Frequently Used, 1-8 = categories
    private var isSearching = false
    private var searchResults: [String] = []
    
    // UserDefaults key for frequently used emojis
    private let frequentlyUsedKey = "TintKeyboardFrequentlyUsedEmojis"
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupEmojiPicker()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupEmojiPicker()
    }
    
    private func setupEmojiPicker() {
        backgroundColor = themeBackground
        
        // Load frequently used emojis from UserDefaults
        loadFrequentlyUsed()
        
        // Search bar at top — full width (iOS layout)
        searchBar = UISearchBar()
        searchBar.translatesAutoresizingMaskIntoConstraints = false
        searchBar.placeholder = "Search Emoji"
        searchBar.searchBarStyle = .minimal
        searchBar.delegate = self
        searchBar.backgroundColor = .clear
        searchBar.backgroundImage = UIImage()
        if let textField = searchBar.value(forKey: "searchField") as? UITextField {
            textField.backgroundColor = UIColor.systemGray5.withAlphaComponent(0.5)
            textField.textColor = themeText
            textField.attributedPlaceholder = NSAttributedString(
                string: "Search Emoji",
                attributes: [NSAttributedString.Key.foregroundColor: themeText.withAlphaComponent(0.6)]
            )
        }
        addSubview(searchBar)
        
        // Collection view with horizontal paging — matches iOS exactly
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .horizontal
        layout.minimumLineSpacing = 0
        layout.minimumInteritemSpacing = 0
        layout.sectionInset = .zero
        
        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        collectionView.backgroundColor = .clear
        collectionView.isPagingEnabled = true
        collectionView.showsHorizontalScrollIndicator = false
        collectionView.delegate = self
        collectionView.dataSource = self
        collectionView.register(EmojiSectionCell.self, forCellWithReuseIdentifier: "EmojiSectionCell")
        addSubview(collectionView)
        
        // Thin separator line above category bar (matches iOS)
        let separator = UIView()
        separator.translatesAutoresizingMaskIntoConstraints = false
        separator.backgroundColor = UIColor.separator
        addSubview(separator)
        
        // Bottom bar — iOS layout: [ABC] [category icons] [⌫]
        categoryBar = UIView()
        categoryBar.translatesAutoresizingMaskIntoConstraints = false
        categoryBar.backgroundColor = .clear
        addSubview(categoryBar)
        
        // ABC button — bottom left (matches iOS emoji keyboard)
        backButton = UIButton(type: .system)
        backButton.translatesAutoresizingMaskIntoConstraints = false
        backButton.setTitle("ABC", for: .normal)
        backButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .regular)
        backButton.setTitleColor(themeText, for: .normal)
        backButton.addTarget(self, action: #selector(backToKeyboard), for: .touchUpInside)
        categoryBar.addSubview(backButton)
        
        // Category icons stack — center of bottom bar
        let categoryStack = UIStackView()
        categoryStack.translatesAutoresizingMaskIntoConstraints = false
        categoryStack.axis = .horizontal
        categoryStack.distribution = .fillEqually
        categoryStack.spacing = 0
        categoryBar.addSubview(categoryStack)
        
        // Backspace button — bottom right (matches iOS emoji keyboard)
        emojiBackspaceButton = UIButton(type: .system)
        let emojiBackspace = emojiBackspaceButton!
        emojiBackspace.translatesAutoresizingMaskIntoConstraints = false
        let bsConfig = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        if let bsImage = UIImage(systemName: "delete.left", withConfiguration: bsConfig) {
            emojiBackspace.setImage(bsImage, for: .normal)
            emojiBackspace.tintColor = themeText
        } else {
            emojiBackspace.setTitle("⌫", for: .normal)
        }
        emojiBackspace.addTarget(self, action: #selector(emojiBackspaceTapped), for: .touchUpInside)
        categoryBar.addSubview(emojiBackspace)
        
        // Create category buttons
        for (index, category) in emojiCategoriesData.enumerated() {
            let button = UIButton(type: .system)
            button.translatesAutoresizingMaskIntoConstraints = false
            
            // Use SF Symbol for category icon — 18pt medium weight (outline for unselected)
            let symbolConfig = UIImage.SymbolConfiguration(pointSize: 18, weight: .medium)
            if let image = UIImage(systemName: category.symbolName, withConfiguration: symbolConfig) {
                button.setImage(image, for: .normal)
                button.tintColor = themeText.withAlphaComponent(0.4)
            } else {
                button.setTitle(category.emojis.first ?? "?", for: .normal)
                button.titleLabel?.font = UIFont.systemFont(ofSize: 18)
            }
            
            button.tag = index
            button.addTarget(self, action: #selector(categoryTapped(_:)), for: .touchUpInside)
            categoryButtons.append(button)
            categoryStack.addArrangedSubview(button)
            
            // Highlight first category (Frequently Used)
            if index == 0 {
                button.tintColor = themeText
                button.backgroundColor = themeText.withAlphaComponent(0.12)
                button.layer.cornerRadius = 8
                button.clipsToBounds = true
            }
        }
        
        NSLayoutConstraint.activate([
            // Search bar — full width at top
            searchBar.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor, constant: 4),
            searchBar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            searchBar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            searchBar.heightAnchor.constraint(equalToConstant: 36),
            
            // Collection view (horizontal paging)
            collectionView.topAnchor.constraint(equalTo: searchBar.bottomAnchor, constant: 4),
            collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: categoryBar.topAnchor),
            
            // Separator line
            separator.leadingAnchor.constraint(equalTo: leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: trailingAnchor),
            separator.bottomAnchor.constraint(equalTo: categoryBar.topAnchor),
            separator.heightAnchor.constraint(equalToConstant: 0.5),
            
            // Bottom bar — 38pt height
            categoryBar.leadingAnchor.constraint(equalTo: leadingAnchor),
            categoryBar.trailingAnchor.constraint(equalTo: trailingAnchor),
            categoryBar.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor),
            categoryBar.heightAnchor.constraint(equalToConstant: 38),
            
            // ABC button — bottom left, fixed width
            backButton.leadingAnchor.constraint(equalTo: categoryBar.leadingAnchor, constant: 4),
            backButton.topAnchor.constraint(equalTo: categoryBar.topAnchor, constant: 2),
            backButton.bottomAnchor.constraint(equalTo: categoryBar.bottomAnchor, constant: -2),
            backButton.widthAnchor.constraint(equalToConstant: 44),
            
            // Category stack — fills the center between ABC and backspace
            categoryStack.leadingAnchor.constraint(equalTo: backButton.trailingAnchor, constant: 2),
            categoryStack.trailingAnchor.constraint(equalTo: emojiBackspace.leadingAnchor, constant: -2),
            categoryStack.topAnchor.constraint(equalTo: categoryBar.topAnchor, constant: 2),
            categoryStack.bottomAnchor.constraint(equalTo: categoryBar.bottomAnchor, constant: -2),
            
            // Backspace button — bottom right, fixed width
            emojiBackspace.trailingAnchor.constraint(equalTo: categoryBar.trailingAnchor, constant: -4),
            emojiBackspace.topAnchor.constraint(equalTo: categoryBar.topAnchor, constant: 2),
            emojiBackspace.bottomAnchor.constraint(equalTo: categoryBar.bottomAnchor, constant: -2),
            emojiBackspace.widthAnchor.constraint(equalToConstant: 44),
        ])
    }
    
    @objc private func emojiBackspaceTapped() {
        delegate?.didTapBackspace()
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }
    
    private func loadFrequentlyUsed() {
        if let saved = UserDefaults.standard.array(forKey: frequentlyUsedKey) as? [String] {
            frequentlyUsed = saved
        } else {
            // Default to some common emojis if none saved
            frequentlyUsed = ["😀", "😂", "🥰", "😍", "🤔", "😎", "🥳", "😭", "😱", "👍", "❤️", "🔥", "💯", "✨", "🎉"]
        }
    }
    
    private func saveFrequentlyUsed() {
        UserDefaults.standard.set(frequentlyUsed, forKey: frequentlyUsedKey)
    }
    
    func addToFrequentlyUsed(_ emoji: String) {
        // Remove if already exists
        frequentlyUsed.removeAll { $0 == emoji }
        // Add to front
        frequentlyUsed.insert(emoji, at: 0)
        // Keep only last 30
        if frequentlyUsed.count > 30 {
            frequentlyUsed = Array(frequentlyUsed.prefix(30))
        }
        saveFrequentlyUsed()
        // Reload if on frequently used section
        if currentSection == 0 {
            collectionView.reloadData()
        }
    }
    
    @objc private func backToKeyboard() {
        NotificationCenter.default.post(name: NSNotification.Name("EmojiPickerDismissed"), object: nil)
    }
    
    @objc private func categoryTapped(_ sender: UIButton) {
        updateCategoryHighlight(activeIndex: sender.tag)
        
        currentSection = sender.tag
        let indexPath = IndexPath(item: 0, section: sender.tag)
        collectionView.scrollToItem(at: indexPath, at: .centeredHorizontally, animated: true)
    }
    
    private func updateCategoryHighlight(activeIndex: Int) {
        for (index, button) in categoryButtons.enumerated() {
            if index == activeIndex {
                button.tintColor = themeText
                button.backgroundColor = themeText.withAlphaComponent(0.12)
                button.layer.cornerRadius = 8
                button.clipsToBounds = true
            } else {
                button.tintColor = themeText.withAlphaComponent(0.4)
                button.backgroundColor = .clear
            }
        }
    }
    
    func applyTheme(background: UIColor, text: UIColor) {
        themeBackground = background
        themeText = text
        
        backgroundColor = background
        backButton.setTitleColor(text, for: .normal)
        emojiBackspaceButton?.tintColor = text
        
        // Update search bar
        if let textField = searchBar.value(forKey: "searchField") as? UITextField {
            textField.textColor = text
            textField.attributedPlaceholder = NSAttributedString(
                string: "Search Emoji",
                attributes: [NSAttributedString.Key.foregroundColor: text.withAlphaComponent(0.6)]
            )
        }
        
        // Update category button colors with highlight
        updateCategoryHighlight(activeIndex: currentSection)
        
        collectionView.reloadData()
    }
    
    // Track scroll position to update active category
    func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
        guard scrollView == collectionView else { return }
        let page = Int(scrollView.contentOffset.x / scrollView.frame.width)
        if page < categoryButtons.count && page != currentSection {
            currentSection = page
            updateCategoryHighlight(activeIndex: page)
        }
    }
    
    func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
        guard scrollView == collectionView else { return }
        let page = Int(scrollView.contentOffset.x / scrollView.frame.width)
        if page < categoryButtons.count && page != currentSection {
            currentSection = page
            updateCategoryHighlight(activeIndex: page)
        }
    }
}

// Cell that contains a vertical scrolling collection view for each emoji category
class EmojiSectionCell: UICollectionViewCell {
    private var collectionView: UICollectionView!
    private var sectionHeaderLabel: UILabel!
    private var emojis: [String] = []
    private var sectionTitle: String = ""
    weak var delegate: KeyboardViewDelegate?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupSection()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupSection()
    }
    
    private func setupSection() {
        // Section header label - iOS shows category name above emoji grid
        sectionHeaderLabel = UILabel()
        sectionHeaderLabel.translatesAutoresizingMaskIntoConstraints = false
        sectionHeaderLabel.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        sectionHeaderLabel.textColor = UIColor.secondaryLabel
        sectionHeaderLabel.textAlignment = .left
        contentView.addSubview(sectionHeaderLabel)
        
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .vertical
        layout.minimumInteritemSpacing = 0
        layout.minimumLineSpacing = 2
        layout.sectionInset = UIEdgeInsets(top: 4, left: 6, bottom: 8, right: 6)
        
        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        collectionView.backgroundColor = .clear
        collectionView.showsVerticalScrollIndicator = false
        collectionView.delegate = self
        collectionView.dataSource = self
        collectionView.register(EmojiCell.self, forCellWithReuseIdentifier: "EmojiCell")
        contentView.addSubview(collectionView)
        
        NSLayoutConstraint.activate([
            sectionHeaderLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            sectionHeaderLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
            sectionHeaderLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
            sectionHeaderLabel.heightAnchor.constraint(equalToConstant: 20),
            
            collectionView.topAnchor.constraint(equalTo: sectionHeaderLabel.bottomAnchor, constant: 2),
            collectionView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
        ])
    }
    
    func configure(emojis: [String], delegate: KeyboardViewDelegate?, sectionTitle: String = "") {
        self.emojis = emojis
        self.delegate = delegate
        self.sectionTitle = sectionTitle
        sectionHeaderLabel.text = sectionTitle
        collectionView.reloadData()
        collectionView.setContentOffset(.zero, animated: false) // Reset scroll on category change
    }
}

extension EmojiSectionCell: UICollectionViewDataSource, UICollectionViewDelegateFlowLayout {
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return emojis.count
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "EmojiCell", for: indexPath) as! EmojiCell
        if indexPath.item < emojis.count {
            cell.configure(emoji: emojis[indexPath.item])
        }
        return cell
    }
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        // iOS uses 5 columns for emojis with minimal spacing
        let availableWidth = collectionView.bounds.width - 12 // 6pt padding on each side
        let columns: CGFloat = 5
        let cellWidth = availableWidth / columns
        return CGSize(width: cellWidth, height: cellWidth)
    }
    
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        if indexPath.item < emojis.count {
            let emoji = emojis[indexPath.item]
            delegate?.didTapKey(emoji)
            
            // Post notification so EmojiPickerView can track frequently used
            NotificationCenter.default.post(name: NSNotification.Name("EmojiSelected"), object: emoji)
            
            // Haptic feedback
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
        }
    }
}

class EmojiCell: UICollectionViewCell {
    private let emojiLabel = UILabel()
    private var longPressGesture: UILongPressGestureRecognizer?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupCell()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupCell()
    }
    
    private func setupCell() {
        backgroundColor = .clear
        contentView.backgroundColor = .clear
        
        emojiLabel.translatesAutoresizingMaskIntoConstraints = false
        emojiLabel.font = UIFont.systemFont(ofSize: 42)
        emojiLabel.textAlignment = .center
        emojiLabel.adjustsFontSizeToFitWidth = true
        emojiLabel.minimumScaleFactor = 0.7
        contentView.addSubview(emojiLabel)
        
        NSLayoutConstraint.activate([
            emojiLabel.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            emojiLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            emojiLabel.widthAnchor.constraint(equalTo: contentView.widthAnchor, multiplier: 0.8),
            emojiLabel.heightAnchor.constraint(equalTo: contentView.heightAnchor, multiplier: 0.8),
        ])
        
        // Add long press gesture for skin tone variations (iOS feature)
        let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
        longPress.minimumPressDuration = 0.3
        contentView.addGestureRecognizer(longPress)
        longPressGesture = longPress
    }
    
    @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
        // TODO: Show skin tone picker for emojis that support it
        // For now, just provide haptic feedback
        if gesture.state == .began {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
        }
    }
    
    override var isHighlighted: Bool {
        didSet {
            UIView.animate(withDuration: 0.1) {
                self.contentView.alpha = self.isHighlighted ? 0.5 : 1.0
            }
        }
    }
    
    func configure(emoji: String) {
        emojiLabel.text = emoji
    }
}

extension EmojiPickerView: UICollectionViewDataSource, UICollectionViewDelegateFlowLayout, UIScrollViewDelegate {
    func numberOfSections(in collectionView: UICollectionView) -> Int {
        return isSearching ? 1 : emojiCategoriesData.count
    }
    
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return 1 // One section cell per category (or one for search results)
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "EmojiSectionCell", for: indexPath) as! EmojiSectionCell
        
        if isSearching {
            cell.configure(emojis: searchResults, delegate: delegate, sectionTitle: "Search Results")
            return cell
        }
        
        let categoryIndex = indexPath.section
        let emojis: [String]
        let title: String
        if categoryIndex == 0 {
            emojis = frequentlyUsed
            title = "Frequently Used"
        } else {
            emojis = emojiCategoriesData[categoryIndex].emojis
            title = emojiCategoriesData[categoryIndex].name.uppercased()
        }
        
        cell.configure(emojis: emojis, delegate: delegate, sectionTitle: title)
        return cell
    }
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        return CGSize(width: collectionView.bounds.width, height: collectionView.bounds.height)
    }
}

extension EmojiPickerView: UISearchBarDelegate {
    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        if searchText.isEmpty {
            isSearching = false
            searchResults = []
        } else {
            isSearching = true
            // Search across all categories for matching emojis
            // Uses emoji descriptions for matching
            searchResults = []
            let query = searchText.lowercased()
            for category in emojiCategoriesData {
                for emoji in category.emojis {
                    // Check if the emoji's Unicode name contains the search text
                    if let unicodeScalar = emoji.unicodeScalars.first {
                        let name = unicodeScalar.properties.name?.lowercased() ?? ""
                        if name.contains(query) {
                            searchResults.append(emoji)
                        }
                    }
                }
            }
            // Also search in frequently used
            for emoji in frequentlyUsed {
                if let unicodeScalar = emoji.unicodeScalars.first {
                    let name = unicodeScalar.properties.name?.lowercased() ?? ""
                    if name.contains(query) && !searchResults.contains(emoji) {
                        searchResults.insert(emoji, at: 0)
                    }
                }
            }
        }
        collectionView.reloadData()
    }
    
    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        searchBar.resignFirstResponder()
    }
    
    func searchBarCancelButtonClicked(_ searchBar: UISearchBar) {
        searchBar.text = ""
        searchBar.resignFirstResponder()
        isSearching = false
        searchResults = []
        collectionView.reloadData()
    }
}

/// Custom UIButton subclass that expands the touchable area beyond the visual bounds.
/// This is critical for making the keyboard feel "forgiving" like iOS.
/// When hitTest directs a touch to a button, the touch-up location (in the button's
/// local coordinate space) might be slightly outside the visual bounds. Without this
/// expansion, .touchUpInside wouldn't fire and no character would be typed.
class ForgivingButton: UIButton {
    /// ADVANCED iOS-STYLE OVERLAPPING TOUCH ZONES:
    /// Implements sophisticated touch area expansion that mimics iOS keyboard behavior.
    /// Creates overlapping zones where frequently used keys get priority.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        // Always accept touches within the visual bounds
        if super.point(inside: point, with: event) {
            return true
        }
        
        let buttonTitle = title(for: .normal) ?? ""
        
        // Determine key type and calculate appropriate tolerance
        var tolerance: CGFloat = 20 // Base tolerance
        
        if buttonTitle == "space" {
            // Space bar gets massive tolerance due to frequency and importance
            tolerance = 45
        } else if ["e", "t", "a", "o", "i", "n", "s", "h", "r"].contains(buttonTitle.lowercased()) {
            // High-frequency letters get extra tolerance
            tolerance = 30
        } else if buttonTitle == "." {
            // Period gets reduced tolerance to favor space bar
            tolerance = 15
        } else if ["q", "w", "p", "a", "l", "z", "x", "m"].contains(buttonTitle.lowercased()) {
            // Edge letters get extra tolerance
            tolerance = 28
        } else {
            // Standard keys get moderate tolerance
            tolerance = 25
        }
        
        // Create asymmetric expansion for better key interaction
        let horizontalExpansion = tolerance
        let verticalExpansion = tolerance * 0.8 // Less vertical expansion
        
        let expandedBounds = bounds.insetBy(dx: -horizontalExpansion, dy: -verticalExpansion)
        return expandedBounds.contains(point)
    }
    
    /// CRITICAL FOR TEXT CENTERING:
    /// Override layoutSubviews to ensure titleLabel and imageView are perfectly centered
    /// UIButton's default layout can misalign content, especially for short strings like "." and "go"
    /// This also handles optical alignment adjustments for period and return/go buttons
    override func layoutSubviews() {
        super.layoutSubviews()
        
        // Force titleLabel to be perfectly centered with optical adjustments
        // UIButton's titleLabel uses frame-based layout, so we can override it directly
        if let titleLabel = titleLabel, let text = titleLabel.text, !text.isEmpty {
            titleLabel.sizeToFit()
            
            let labelSize = titleLabel.bounds.size
            let buttonSize = bounds.size
            
            // Calculate base center position
            var centerX = (buttonSize.width - labelSize.width) / 2
            var centerY = (buttonSize.height - labelSize.height) / 2
            
            // OPTICAL ALIGNMENT ADJUSTMENTS:
            
            // Period button (tag 999): No optical adjustment needed
            // The slight shift was causing misalignment - iOS centers it perfectly
            // The spacing adjustments in createBottomRow handle the visual balance
            if tag == 999 && text == "." {
                // No adjustment - let it center naturally
            }
            
            // Return/Go buttons (tag 998): Account for cap height vs line height
            // The titleEdgeInsets already adds top offset, but we need to ensure
            // the label itself is positioned correctly accounting for that offset
            if tag == 998 {
                // The titleEdgeInsets.top (1.5pt) already handles the vertical adjustment,
                // but we ensure horizontal centering is perfect
                // No additional adjustment needed - titleEdgeInsets handles vertical
            }
            
            // Override UIButton's automatic titleLabel positioning
            titleLabel.frame = CGRect(
                x: centerX,
                y: centerY,
                width: labelSize.width,
                height: labelSize.height
            )
        }
        
        // Force imageView to be perfectly centered (when no title)
        if let imageView = imageView, imageView.image != nil, titleLabel?.text?.isEmpty != false {
            imageView.sizeToFit()
            
            let imageSize = imageView.bounds.size
            let buttonSize = bounds.size
            
            let centerX = (buttonSize.width - imageSize.width) / 2
            let centerY = (buttonSize.height - imageSize.height) / 2
            
            imageView.frame = CGRect(
                x: centerX,
                y: centerY,
                width: imageSize.width,
                height: imageSize.height
            )
        }
    }
}

enum KeyboardMode {
    case letters
    case numbers
    case symbols
}

enum ShiftState {
    case off
    case on
    case capsLock
}

/// iOS-style key preview balloon that appears above keys on touchDown
/// Shows a magnified version of the key character, with a speech-bubble shape
/// extending from the pressed key. Matches the native iOS keyboard pop-up.
class KeyPreviewView: UIView {
    private let label = UILabel()
    private let shapeLayer = CAShapeLayer()
    
    // Preview dimensions matching iOS
    private let previewWidth: CGFloat = 56
    private let previewHeight: CGFloat = 56
    private let stemHeight: CGFloat = 10  // The "stem" that connects to the key below
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupPreview()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupPreview()
    }
    
    private func setupPreview() {
        backgroundColor = .clear
        isUserInteractionEnabled = false
        
        shapeLayer.fillColor = UIColor.white.cgColor
        shapeLayer.shadowColor = UIColor.black.cgColor
        shapeLayer.shadowOffset = CGSize(width: 0, height: 1)
        shapeLayer.shadowRadius = 3
        shapeLayer.shadowOpacity = 0.3
        layer.addSublayer(shapeLayer)
        
        label.translatesAutoresizingMaskIntoConstraints = false
        label.font = UIFont.systemFont(ofSize: 32, weight: .light)
        label.textAlignment = .center
        label.textColor = .black
        addSubview(label)
        
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.centerYAnchor.constraint(equalTo: topAnchor, constant: previewHeight * 0.45),
        ])
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        updateShape()
    }
    
    private func updateShape() {
        let totalHeight = previewHeight + stemHeight
        let cornerRadius: CGFloat = 9
        
        let path = UIBezierPath()
        
        // Draw rounded rectangle for the preview bubble
        let bubbleRect = CGRect(x: 0, y: 0, width: previewWidth, height: previewHeight)
        let bubblePath = UIBezierPath(roundedRect: bubbleRect, cornerRadius: cornerRadius)
        path.append(bubblePath)
        
        // Draw the stem (trapezoid connecting bubble to key position below)
        let stemTop = previewHeight
        let stemBottom = totalHeight
        let stemTopLeft = previewWidth * 0.25
        let stemTopRight = previewWidth * 0.75
        let stemBottomLeft = previewWidth * 0.3
        let stemBottomRight = previewWidth * 0.7
        
        let stemPath = UIBezierPath()
        stemPath.move(to: CGPoint(x: stemTopLeft, y: stemTop))
        stemPath.addLine(to: CGPoint(x: stemTopRight, y: stemTop))
        stemPath.addLine(to: CGPoint(x: stemBottomRight, y: stemBottom))
        stemPath.addLine(to: CGPoint(x: stemBottomLeft, y: stemBottom))
        stemPath.close()
        path.append(stemPath)
        
        shapeLayer.path = path.cgPath
    }
    
    func setText(_ text: String) {
        label.text = text
    }
    
    func setColors(background: UIColor, text: UIColor) {
        shapeLayer.fillColor = background.cgColor
        label.textColor = text
    }
    
    func show(above button: UIButton, in container: UIView) {
        guard container.bounds.width > 0 && container.bounds.height > 0 else { return }
        
        let buttonFrame = button.convert(button.bounds, to: container)
        guard !buttonFrame.isInfinite && !buttonFrame.isNull && buttonFrame.width > 0 else { return }
        
        let totalHeight = previewHeight + stemHeight
        let previewX = buttonFrame.midX - previewWidth / 2
        let previewY = buttonFrame.minY - totalHeight + 4 // Slight overlap with key
        
        let safeX = max(2, min(previewX, container.bounds.width - previewWidth - 2))
        let safeY = max(0, previewY)
        
        frame = CGRect(x: safeX, y: safeY, width: previewWidth, height: totalHeight)
        container.addSubview(self)
        alpha = 0
        transform = CGAffineTransform(scaleX: 0.6, y: 0.6)
            .concatenating(CGAffineTransform(translationX: 0, y: 10))
        
        UIView.animate(withDuration: 0.05, delay: 0, options: .curveEaseOut) {
            self.alpha = 1
            self.transform = .identity
        }
    }
    
    func hide() {
        UIView.animate(withDuration: 0.05, delay: 0, options: .curveEaseIn, animations: {
            self.alpha = 0
            self.transform = CGAffineTransform(scaleX: 0.6, y: 0.6)
                .concatenating(CGAffineTransform(translationX: 0, y: 10))
        }) { _ in
            self.removeFromSuperview()
        }
    }
}

class KeyboardView: UIView {
    
    weak var delegate: KeyboardViewDelegate? {
        didSet {
            // Update emoji picker delegate when keyboard delegate is set
            if let delegate = delegate {
                emojiPickerView?.delegate = delegate
            }
        }
    }
    
    private var keyButtons: [UIButton] = []
    private var backgroundView: UIView!
    private var gradientLayer: CAGradientLayer?
    private var emojiPickerView: EmojiPickerView!
    private var keyboardContainerView: UIView!
    private var currentMode: KeyboardMode = .letters
    private var shiftState: ShiftState = .off
    private var returnKeyType: UIReturnKeyType = .default
    private var keyboardType: UIKeyboardType = .default
    private var lastSpaceTapTime: TimeInterval = 0
    private var lastShiftTapTime: TimeInterval = 0
    private var keyPreview: KeyPreviewView?
    private var currentPreviewButton: UIButton?
    private var selectionFeedback: UISelectionFeedbackGenerator?
    private var impactFeedback: UIImpactFeedbackGenerator?
    private var pressedKeys: Set<UIButton> = []
    private var backspaceTimer: Timer?
    private var backspaceRepeatCount = 0
    private var isShowingEmojiPicker = false
    private var heightConstraint: NSLayoutConstraint?
    
    // Touch tracking for smooth typing - iOS tracks finger movement continuously
    private var activeTouch: UITouch?
    private var activeButton: UIButton? // The button currently "under" the finger
    private var initialButton: UIButton? // The button where touch started
    
    // Enhanced touch tracking for iOS-like behavior
    private var touchStartTime: CFTimeInterval = 0
    private var initialTouchPoint: CGPoint?
    
    // Advanced typing pattern analysis for touch prediction
    private var lastKeyTapTime: CFTimeInterval = 0
    private var lastTappedKey: String = ""
    private var typingVelocity: CGFloat = 0
    private var recentTouchPoints: [CGPoint] = []
    private var recentKeySequence: [String] = []
    
    // Performance optimizations for smooth typing
    // TEMPORARILY DISABLED: cachedButtonCenters, lastTouchPoint, lastFoundButton
    // These were causing incorrect key detection - will re-enable once coordinate system is fixed
    // private var cachedButtonCenters: [(button: UIButton, center: CGPoint, rowIndex: Int)] = []
    // private var lastTouchPoint: CGPoint?
    // private var lastFoundButton: UIButton?
    private var pressedKeyColor: UIColor?
    private var pressedKeyColorDark: UIColor?
    
    private var isShifted: Bool {
        return shiftState != .off
    }
    
    private var standardKeyWidth: CGFloat {
        let screenWidth = UIScreen.main.bounds.width
        let totalPadding = (3 * 2) + (6 * 9)
        return (screenWidth - CGFloat(totalPadding)) / 10
    }

    var showsNextKeyboardKey: Bool = true {
        didSet { buildKeyboard() }
    }
    
    private let letterRows = [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["z", "x", "c", "v", "b", "n", "m"]
    ]
    
    private let numberRows = [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""],
        [".", ",", "?", "!", "'"]
    ]
    
    private let symbolRows = [
        ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="],
        ["_", "\\", "|", "~", "<", ">", "€", "£", "¥", "•"],
        [".", ",", "?", "!", "'"]
    ]
    
    // Theme colors - updated via applyTheme()
    private var keyBackgroundColor: UIColor = UIColor(white: 0.27, alpha: 1.0)
    
    private var specialKeyBackgroundColor: UIColor {
        // Special keys use the same color as regular keys
        return keyBackgroundColor
    }
    
    private var keyTextColor: UIColor = UIColor.label
    private var keyboardBackgroundColor: UIColor {
        if traitCollection.userInterfaceStyle == .dark {
            return UIColor(white: 0.0, alpha: 0.2)
        } else {
            return UIColor.systemGray6
        }
    }
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        selectionFeedback = UISelectionFeedbackGenerator()
        impactFeedback = UIImpactFeedbackGenerator(style: .light)
        // Keep haptics prepared at all times for immediate feedback (optimization)
        selectionFeedback?.prepare()
        impactFeedback?.prepare()
        setupKeyboard()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        selectionFeedback = UISelectionFeedbackGenerator()
        impactFeedback = UIImpactFeedbackGenerator(style: .light)
        // Keep haptics prepared at all times for immediate feedback (optimization)
        selectionFeedback?.prepare()
        impactFeedback?.prepare()
        setupKeyboard()
    }
    
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if traitCollection.userInterfaceStyle != previousTraitCollection?.userInterfaceStyle {
            buildKeyboard()
        }
    }
    
    // MARK: - Dynamic Hit Zones (Full Spatial Model)
    // 
    // THE KEY TO SMOOTH TYPING: iOS keyboards use a "spatial model" where EVERY touch
    // is resolved to the nearest key center — not just touches in gaps. This means:
    //   - Tapping at the edge of "R" but closer to "T"'s center → registers as "T"
    //   - Tapping in the 6pt gap between keys → registers as the nearest key
    //   - Tapping slightly above/below a row → registers as the nearest key in that row
    //
    // The previous implementation only used the spatial model for gap touches (checking
    // `if standardHit is UIButton { return standardHit }` first). This meant 95%+ of
    // touches bypassed the spatial model entirely, making typing feel rigid/"hit or miss."
    //
    // Now we ALWAYS find the nearest key center for every touch within the keyboard area.
    // Combined with ForgivingButton's expanded point(inside:with:), this ensures that
    // .touchUpInside fires reliably even when the touch started slightly outside the
    // button's visual bounds.
    
    // ── APPLE'S TOUCH TRACKING STRATEGY ──
    // iOS keyboards don't just use hitTest once. They continuously track finger movement
    // and update which key is "active" as the finger moves. This allows users to:
    //   1. Start on one key, realize it's wrong, slide to the correct key
    //   2. Get visual feedback (key highlight/preview) that follows the finger
    //   3. Have the character commit based on where the finger LIFTS, not where it started
    //
    // We implement this by overriding touchesBegan/Moved/Ended to track the active button
    // as the finger moves, then using hitTest to find the nearest key at each point.
    
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard !isShowingEmojiPicker, let touch = touches.first else {
            super.touchesBegan(touches, with: event)
            return
        }
        
        let point = touch.location(in: self)
        guard self.point(inside: point, with: event) else {
            super.touchesBegan(touches, with: event)
            return
        }
        
        // Store touch information for advanced pattern analysis
        touchStartTime = CACurrentMediaTime()
        initialTouchPoint = point
        
        // Update typing velocity and patterns for prediction
        let currentTime = touchStartTime
        if lastKeyTapTime > 0 {
            let timeDelta = currentTime - lastKeyTapTime
            typingVelocity = 1.0 / max(timeDelta, 0.05) // WPM-like metric
        }
        
        // Maintain recent touch history for pattern recognition
        recentTouchPoints.append(point)
        if recentTouchPoints.count > 5 {
            recentTouchPoints.removeFirst()
        }
        
        // Find the nearest key using predictive spatial model
        if let button = findNearestKeyWithPrediction(to: point) {
            activeTouch = touch
            initialButton = button
            activeButton = button
            
            // Send touchDown with optimized timing for iOS-like feel
            DispatchQueue.main.async {
                button.sendActions(for: .touchDown)
            }
        } else {
            super.touchesBegan(touches, with: event)
        }
    }
    
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard !isShowingEmojiPicker,
              let touch = activeTouch,
              touches.contains(touch) else {
            super.touchesMoved(touches, with: event)
            return
        }
        
        let point = touch.location(in: self)
        
        // Calculate movement from initial touch for gesture analysis
        if let startPoint = initialTouchPoint {
            let dx = point.x - startPoint.x
            let dy = point.y - startPoint.y
            let distance = sqrt(dx * dx + dy * dy)
            
            // iOS-style movement threshold before key switching
            // Small movements don't immediately switch keys for stability
            let movementThreshold: CGFloat = 8
            if distance < movementThreshold && activeButton == initialButton {
                return // Stay on initial key for small movements
            }
        }
        
        // Find the nearest key with predictive spatial model
        if let newButton = findNearestKeyWithPrediction(to: point) {
            if newButton != activeButton {
                // Finger moved to a different key
                if let oldButton = activeButton {
                    // Cancel touch on old button with slight delay for smoother transition
                    DispatchQueue.main.async {
                        oldButton.sendActions(for: .touchCancel)
                    }
                }
                
                activeButton = newButton
                // Start touch on new button with optimized timing
                DispatchQueue.main.async {
                    newButton.sendActions(for: .touchDown)
                }
            }
        }
        
        // Don't call super - we're handling this ourselves
    }
    
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard !isShowingEmojiPicker,
              let touch = activeTouch,
              touches.contains(touch) else {
            super.touchesEnded(touches, with: event)
            return
        }
        
        // Commit based on where finger lifted (activeButton), not where it started
        if let button = activeButton {
            button.sendActions(for: .touchUpInside)
        }
        
        activeTouch = nil
        activeButton = nil
        initialButton = nil
    }
    
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard !isShowingEmojiPicker,
              let touch = activeTouch,
              touches.contains(touch) else {
            super.touchesCancelled(touches, with: event)
            return
        }
        
        if let button = activeButton {
            button.sendActions(for: .touchCancel)
        }
        
        activeTouch = nil
        activeButton = nil
        initialButton = nil
    }
    
    // Helper: Find nearest key using advanced iOS-style spatial model
    // Implements overlapping touch zones and frequency-based prioritization
    private func findNearestKey(to point: CGPoint) -> UIButton? {
        // iOS-style spatial parameters with overlapping zones
        let verticalWeight: CGFloat = 1.8 // Reduced for more horizontal forgiveness
        let maxSnapDistance: CGFloat = 75 // Increased base tolerance
        
        // Advanced touch zone bonuses based on key importance and position
        let edgeBonus: CGFloat = 15 // Increased edge tolerance
        let cornerBonus: CGFloat = 20 // Increased corner tolerance
        let frequentKeyBonus: CGFloat = 12 // Extra tolerance for common keys
        
        var nearestButton: UIButton?
        var minWeightedDistance: CGFloat = .infinity
        
        // Ensure layout is complete before calculating centers
        self.layoutIfNeeded()
        
        // Special variables to track space bar vs period conflict resolution
        var spaceBarCandidate: UIButton?
        var spaceBarDistance: CGFloat = .infinity
        var periodCandidate: UIButton?
        var periodDistance: CGFloat = .infinity
        
        // Calculate centers on-demand with iOS-style spatial model
        for button in keyButtons {
            guard !button.isHidden, button.alpha > 0, button.window != nil else { continue }
            
            // Ensure button layout is complete
            button.layoutIfNeeded()
            
            // Calculate center and bounds in self's coordinate space
            let center = button.convert(
                CGPoint(x: button.bounds.midX, y: button.bounds.midY),
                to: self
            )
            let buttonFrame = button.convert(button.bounds, to: self)
            
            let dx = point.x - center.x
            let dy = point.y - center.y
            
            // Identify space bar and period key for special handling
            let buttonTitle = button.title(for: .normal) ?? ""
            let isSpaceBar = buttonTitle == "space"
            let isPeriodKey = buttonTitle == "."
            
            // Advanced key classification for intelligent touch handling
            let isEdgeKey = buttonFrame.minX <= 25 || buttonFrame.maxX >= bounds.width - 25
            let isCornerKey = (buttonFrame.minY <= 25 || buttonFrame.maxY >= bounds.height - 25) && isEdgeKey
            
            // Identify high-frequency keys that need extra tolerance
            let isFrequentKey = ["e", "t", "a", "o", "i", "n", "s", "h", "r"].contains(buttonTitle.lowercased())
            let isSpaceKey = isSpaceBar
            
            // Dynamic snap distance based on key importance and position
            var effectiveSnapDistance = maxSnapDistance
            if isSpaceKey {
                effectiveSnapDistance += 30 // Massive space bar tolerance
            } else if isCornerKey {
                effectiveSnapDistance += cornerBonus
            } else if isEdgeKey {
                effectiveSnapDistance += edgeBonus
            } else if isFrequentKey {
                effectiveSnapDistance += frequentKeyBonus
            }
            
            // Quick bounds check with dynamic distance
            if abs(dx) > effectiveSnapDistance || abs(dy) > effectiveSnapDistance {
                continue
            }
            
            // iOS-style weighted distance with pressure simulation
            // Horizontal movement is more forgiving than vertical
            let horizontalComponent = dx * dx
            let verticalComponent = dy * dy * verticalWeight * verticalWeight
            let weightedDistance = sqrt(horizontalComponent + verticalComponent)
            
            // Special handling for space bar vs period key conflict
            if isSpaceBar {
                spaceBarCandidate = button
                spaceBarDistance = weightedDistance
            }
            if isPeriodKey {
                periodCandidate = button
                // Add penalty to period key if touch comes from the left (space bar side)
                // This reduces period key sensitivity when touched from space bar area
                let periodPenalty = dx < 0 ? 20.0 : 0.0 // 20pt penalty for left-side touches
                periodDistance = weightedDistance + periodPenalty
            }
            
            // Apply intelligent distance adjustments based on key characteristics
            var adjustedDistance = weightedDistance
            if isSpaceKey {
                adjustedDistance *= 0.7 // Strong space bar preference
            } else if isFrequentKey {
                adjustedDistance *= 0.9 // Slight preference for common letters
            } else if isEdgeKey {
                adjustedDistance *= 0.85 // Edge key assistance
            }
            
            if adjustedDistance < minWeightedDistance && weightedDistance < effectiveSnapDistance {
                minWeightedDistance = adjustedDistance
                nearestButton = button
            }
        }
        
        // AGGRESSIVE SPACE BAR PROTECTION:
        // iOS heavily prioritizes space bar over period due to frequency and importance
        if let spaceBar = spaceBarCandidate, let period = periodCandidate {
            let spaceBarFrame = spaceBar.convert(spaceBar.bounds, to: self)
            let periodFrame = period.convert(period.bounds, to: self)
            
            // Rule 1: Space bar "owns" a much larger area extending significantly right
            // This creates a strong bias toward space bar for ambiguous touches
            let spaceBarDominantArea = spaceBarFrame.insetBy(dx: -25, dy: -12)
            let spaceBarRightExtension = CGRect(
                x: spaceBarFrame.maxX - 10,
                y: spaceBarFrame.minY - 12,
                width: 40, // Extend 30pt into period territory
                height: spaceBarFrame.height + 24
            )
            
            if spaceBarDominantArea.contains(point) || spaceBarRightExtension.contains(point) {
                return spaceBar
            }
            
            // Rule 2: If both are candidates, strongly favor space unless clearly in period zone
            if nearestButton == period {
                // Only allow period if touch is clearly in the right 60% of period key
                let periodRightZone = CGRect(
                    x: periodFrame.minX + (periodFrame.width * 0.4),
                    y: periodFrame.minY,
                    width: periodFrame.width * 0.6,
                    height: periodFrame.height
                )
                
                if !periodRightZone.contains(point) {
                    return spaceBar // Favor space bar unless clearly in period's right zone
                }
            }
            
            // Rule 3: For gap touches or ambiguous cases, always prefer space
            if spaceBarDistance < periodDistance + 25 { // Increased threshold
                return spaceBar
            }
        }
        
        return nearestButton
    }
    
    // Advanced predictive spatial model that considers typing patterns
    private func findNearestKeyWithPrediction(to point: CGPoint) -> UIButton? {
        // Start with the standard spatial model
        guard let baseResult = findNearestKey(to: point) else { return nil }
        
        // Apply predictive corrections based on typing patterns
        let baseTitle = baseResult.title(for: .normal) ?? ""
        
        // Fast typing correction: if typing quickly, be more forgiving
        if typingVelocity > 3.0 { // Fast typing threshold
            // Check for common fast typing errors and corrections
            if let correctedKey = applyFastTypingCorrection(originalKey: baseTitle, touchPoint: point) {
                return correctedKey
            }
        }
        
        // Sequence-based prediction: predict next likely keys
        if recentKeySequence.count >= 2 {
            let lastTwo = Array(recentKeySequence.suffix(2))
            if let predictedKey = applySequencePrediction(sequence: lastTwo, touchPoint: point, nearestKey: baseResult) {
                return predictedKey
            }
        }
        
        return baseResult
    }
    
    // Apply corrections for fast typing scenarios
    private func applyFastTypingCorrection(originalKey: String, touchPoint: CGPoint) -> UIButton? {
        // Common fast typing error patterns
        let errorCorrections: [String: [String]] = [
            ".": [" "], // Period instead of space - CRITICAL FIX
            "m": ["n"], // m/n confusion
            "b": ["v", "n"], // b/v/n confusion  
            "p": ["o"], // p/o confusion
        ]
        
        if let alternatives = errorCorrections[originalKey.lowercased()] {
            for altKey in alternatives {
                if let altButton = findKeyButton(with: altKey) {
                    let altFrame = altButton.convert(altButton.bounds, to: self)
                    let altCenter = CGPoint(x: altFrame.midX, y: altFrame.midY)
                    let distanceToAlt = sqrt(pow(touchPoint.x - altCenter.x, 2) + pow(touchPoint.y - altCenter.y, 2))
                    
                    // If alternative is reasonably close, prefer it during fast typing
                    if distanceToAlt < 60 {
                        return altButton
                    }
                }
            }
        }
        
        return nil
    }
    
    // Apply sequence-based predictions for common letter combinations
    private func applySequencePrediction(sequence: [String], touchPoint: CGPoint, nearestKey: UIButton) -> UIButton? {
        // Common sequences that often end with space
        let spaceSequences = ["he", "th", "an", "in", "to", "of", "it", "be", "as", "at", "on", "or"]
        let sequenceKey = sequence.joined().lowercased()
        
        // If we're in a sequence that commonly ends with space, and touch is ambiguous,
        // strongly favor space over other keys
        if spaceSequences.contains(sequenceKey) {
            if let spaceButton = findKeyButton(with: " ") {
                let spaceFrame = spaceButton.convert(spaceButton.bounds, to: self)
                let spaceCenter = CGPoint(x: spaceFrame.midX, y: spaceFrame.midY)
                let distanceToSpace = sqrt(pow(touchPoint.x - spaceCenter.x, 2) + pow(touchPoint.y - spaceCenter.y, 2))
                
                // If touch is anywhere near space bar area, prefer it
                if distanceToSpace < 80 {
                    return spaceButton
                }
            }
        }
        
        return nil
    }
    
    // Helper to find button with specific title
    private func findKeyButton(with title: String) -> UIButton? {
        for button in keyButtons {
            let buttonTitle = button.title(for: .normal)?.lowercased() ?? ""
            let accessibilityTitle = button.accessibilityLabel?.lowercased() ?? ""
            
            if buttonTitle == title.lowercased() || accessibilityTitle == title.lowercased() {
                return button
            }
            
            // Special case for space
            if title == " " && buttonTitle == "space" {
                return button
            }
        }
        return nil
    }
    
    // TEMPORARILY DISABLED: updateCachedButtonCenters()
    // This was causing incorrect key detection due to coordinate system issues
    // Will re-enable once coordinate conversion is fixed
    /*
    private func updateCachedButtonCenters() {
        cachedButtonCenters.removeAll()
        
        // Group buttons by approximate row (Y coordinate)
        var rowGroups: [Int: [(button: UIButton, center: CGPoint)]] = [:]
        
        for button in keyButtons {
            guard !button.isHidden, button.alpha > 0, button.window != nil else { continue }
            
            let center = button.convert(
                CGPoint(x: button.bounds.midX, y: button.bounds.midY),
                to: self
            )
            
            // Group by row index (rounded Y coordinate divided by approximate row height)
            let rowIndex = Int(center.y / 50) // Approximate row height
            if rowGroups[rowIndex] == nil {
                rowGroups[rowIndex] = []
            }
            rowGroups[rowIndex]?.append((button: button, center: center))
        }
        
        // Flatten into array with row index
        for (rowIndex, buttons) in rowGroups {
            for (button, center) in buttons {
                cachedButtonCenters.append((button: button, center: center, rowIndex: rowIndex))
            }
        }
    }
    */
    
    // Keep hitTest for non-touch events (accessibility, etc.)
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard !isShowingEmojiPicker else {
            return super.hitTest(point, with: event)
        }
        
        guard self.point(inside: point, with: event) else {
            return nil
        }
        
        // For non-touch events, use the same logic
        return findNearestKey(to: point) ?? super.hitTest(point, with: event)
    }
    
    private func setupKeyboard() {
        backgroundColor = .clear
        
        let blurEffect = UIBlurEffect(style: traitCollection.userInterfaceStyle == .dark ? .systemThinMaterialDark : .systemThinMaterialLight)
        let blurView = UIVisualEffectView(effect: blurEffect)
        blurView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(blurView)
        
        // Container for keyboard view
        keyboardContainerView = UIView()
        keyboardContainerView.translatesAutoresizingMaskIntoConstraints = false
        keyboardContainerView.backgroundColor = .clear
        addSubview(keyboardContainerView)
        
        backgroundView = UIView()
        backgroundView.translatesAutoresizingMaskIntoConstraints = false
        backgroundView.backgroundColor = .clear
        keyboardContainerView.addSubview(backgroundView)
        
        // Emoji picker view
        emojiPickerView = EmojiPickerView()
        emojiPickerView.translatesAutoresizingMaskIntoConstraints = false
        emojiPickerView.isHidden = true
        emojiPickerView.delegate = delegate
        addSubview(emojiPickerView)
        
        // Standard keyboard height — 291pt matches the iOS regular keyboard on modern iPhones
        // This is dynamically changed when emoji picker is shown (emoji keyboard is taller)
        heightConstraint = backgroundView.heightAnchor.constraint(equalToConstant: 291)
        heightConstraint?.priority = .defaultHigh
        heightConstraint?.isActive = true
        
        NSLayoutConstraint.activate([
            blurView.leadingAnchor.constraint(equalTo: leadingAnchor),
            blurView.trailingAnchor.constraint(equalTo: trailingAnchor),
            blurView.topAnchor.constraint(equalTo: topAnchor),
            blurView.bottomAnchor.constraint(equalTo: bottomAnchor),
            keyboardContainerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            keyboardContainerView.trailingAnchor.constraint(equalTo: trailingAnchor),
            keyboardContainerView.topAnchor.constraint(equalTo: topAnchor),
            keyboardContainerView.bottomAnchor.constraint(equalTo: bottomAnchor),
            backgroundView.leadingAnchor.constraint(equalTo: keyboardContainerView.leadingAnchor),
            backgroundView.trailingAnchor.constraint(equalTo: keyboardContainerView.trailingAnchor),
            backgroundView.topAnchor.constraint(equalTo: keyboardContainerView.topAnchor),
            backgroundView.bottomAnchor.constraint(equalTo: keyboardContainerView.bottomAnchor),
            emojiPickerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            emojiPickerView.trailingAnchor.constraint(equalTo: trailingAnchor),
            emojiPickerView.topAnchor.constraint(equalTo: topAnchor),
            emojiPickerView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        
        buildKeyboard()
        
        // Listen for emoji picker dismissal
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleEmojiPickerDismissed),
            name: NSNotification.Name("EmojiPickerDismissed"),
            object: nil
        )
        
        // Listen for emoji selection to update frequently used
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleEmojiSelected(_:)),
            name: NSNotification.Name("EmojiSelected"),
            object: nil
        )
    }
    
    @objc private func handleEmojiPickerDismissed() {
        if isShowingEmojiPicker {
            toggleEmojiPicker()
        }
    }
    
    @objc private func handleEmojiSelected(_ notification: Notification) {
        if let emoji = notification.object as? String {
            emojiPickerView?.addToFrequentlyUsed(emoji)
        }
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    private func buildKeyboard() {
        pressedKeys.removeAll()
        keyButtons.forEach { $0.removeFromSuperview() }
        keyButtons.removeAll()
        backgroundView.subviews.forEach { if $0 != backgroundView { $0.removeFromSuperview() } }
        
        let vStack = UIStackView()
        vStack.axis = .vertical
        vStack.alignment = .fill
        vStack.distribution = .fill
        vStack.spacing = 12
        vStack.translatesAutoresizingMaskIntoConstraints = false
        backgroundView.addSubview(vStack)

        NSLayoutConstraint.activate([
            vStack.leadingAnchor.constraint(equalTo: backgroundView.leadingAnchor, constant: 3),
            vStack.trailingAnchor.constraint(equalTo: backgroundView.trailingAnchor, constant: -3),
            vStack.topAnchor.constraint(equalTo: backgroundView.topAnchor, constant: 8),
            vStack.bottomAnchor.constraint(equalTo: backgroundView.safeAreaLayoutGuide.bottomAnchor, constant: -4),
        ])

        switch currentMode {
        case .letters:
            vStack.addArrangedSubview(makeKeyRow(keys: letterRows[0], leftInset: 0, rightInset: 0))
            let row2 = makeKeyRow(keys: letterRows[1], leftInset: 0, rightInset: 0)
            vStack.addArrangedSubview(row2)
            vStack.addArrangedSubview(makeLetterThirdRow())
        case .numbers:
            vStack.addArrangedSubview(makeKeyRow(keys: numberRows[0], leftInset: 0, rightInset: 0))
            vStack.addArrangedSubview(makeKeyRow(keys: numberRows[1], leftInset: 0, rightInset: 0))
            vStack.addArrangedSubview(makeNumbersOrSymbolsThirdRow(leftTitle: "#+=", leftAction: #selector(symbolsTapped)))
        case .symbols:
            vStack.addArrangedSubview(makeKeyRow(keys: symbolRows[0], leftInset: 0, rightInset: 0))
            vStack.addArrangedSubview(makeKeyRow(keys: symbolRows[1], leftInset: 0, rightInset: 0))
            vStack.addArrangedSubview(makeNumbersOrSymbolsThirdRow(leftTitle: "123", leftAction: #selector(numbersTapped)))
        }

        vStack.addArrangedSubview(createBottomRow())
        
        // TEMPORARILY DISABLED: updateCachedButtonCenters()
        // Button centers are now calculated on-demand in findNearestKey()
    }
    
    private func makeKeyRow(keys: [String], leftInset: CGFloat, rightInset: CGFloat) -> UIView {
        let container = UIView()

        let hStack = UIStackView()
        hStack.axis = .horizontal
        hStack.alignment = .fill
        hStack.distribution = .fillEqually
        hStack.spacing = 6
        hStack.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(hStack)
        
        let isRow2 = (keys.count == 9 && currentMode == .letters)
        
        if isRow2 {
            let standardSpacing: CGFloat = 6
            let row2Width = (standardKeyWidth * 9) + (standardSpacing * 8)
            
            NSLayoutConstraint.activate([
                hStack.centerXAnchor.constraint(equalTo: container.centerXAnchor),
                hStack.widthAnchor.constraint(equalToConstant: row2Width),
                hStack.topAnchor.constraint(equalTo: container.topAnchor),
                hStack.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            ])
        } else {
            NSLayoutConstraint.activate([
                hStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: leftInset),
                hStack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -rightInset),
                hStack.topAnchor.constraint(equalTo: container.topAnchor),
                hStack.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            ])
        }

        keys.forEach { key in
            let button = createKeyButton(title: key)
            button.heightAnchor.constraint(equalToConstant: 42).isActive = true
            hStack.addArrangedSubview(button)
            keyButtons.append(button)
        }

        return container
    }

    private func makeLetterThirdRow() -> UIView {
        let container = UIView()

        // iOS dimensions: shift & backspace are ~42pt, letter keys match rows 1 & 2
        let specialKeyWidth: CGFloat = 42
        let middleSpacing: CGFloat = 6
        let middleKeyCount = CGFloat(letterRows[2].count) // 7
        let middleWidth = (standardKeyWidth * middleKeyCount) + (middleSpacing * (middleKeyCount - 1))
        
        // Shift button
        let shiftButton = createSpecialKeyButton(title: "⇧")
        shiftButton.accessibilityLabel = "shift"
        shiftButton.addTarget(self, action: #selector(shiftTapped), for: [.touchUpInside, .touchUpOutside])
        shiftButton.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        keyButtons.append(shiftButton)
        container.addSubview(shiftButton)
        
        // Middle letter keys — same width as rows 1 & 2, centered in the row
        let middle = UIStackView()
        middle.axis = .horizontal
        middle.alignment = .fill
        middle.distribution = .fillEqually
        middle.spacing = middleSpacing
        middle.translatesAutoresizingMaskIntoConstraints = false
        letterRows[2].forEach { key in
            let button = createKeyButton(title: key)
            button.heightAnchor.constraint(equalToConstant: 42).isActive = true
            middle.addArrangedSubview(button)
            keyButtons.append(button)
        }
        container.addSubview(middle)
        
        // Backspace button
        let backspaceButton = createSpecialKeyButton(title: "⌫")
        backspaceButton.addTarget(self, action: #selector(backspaceTouchDown(_:)), for: .touchDown)
        backspaceButton.addTarget(self, action: #selector(backspaceTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        keyButtons.append(backspaceButton)
        container.addSubview(backspaceButton)
        
        NSLayoutConstraint.activate([
            // Shift — left-aligned, fixed width
            shiftButton.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            shiftButton.topAnchor.constraint(equalTo: container.topAnchor),
            shiftButton.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            shiftButton.widthAnchor.constraint(equalToConstant: specialKeyWidth),
            
            // Middle — centered, fixed width so each key = standardKeyWidth
            middle.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            middle.topAnchor.constraint(equalTo: container.topAnchor),
            middle.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            middle.widthAnchor.constraint(equalToConstant: middleWidth),
            
            // Backspace — right-aligned, fixed width
            backspaceButton.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            backspaceButton.topAnchor.constraint(equalTo: container.topAnchor),
            backspaceButton.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            backspaceButton.widthAnchor.constraint(equalToConstant: specialKeyWidth),
        ])

        return container
    }

    private func makeNumbersOrSymbolsThirdRow(leftTitle: String, leftAction: Selector) -> UIView {
        let container = UIView()

        // iOS dimensions: special keys ~42pt, gaps ~15pt between special keys and character group
        let specialKeyWidth: CGFloat = 42
        let sideGap: CGFloat = 15  // gap between special keys and middle character group (matches iOS)
        
        // Left special button (#+=, 123, etc.)
        let leftButton = createSpecialKeyButton(title: leftTitle)
        leftButton.addTarget(self, action: leftAction, for: [.touchUpInside, .touchUpOutside])
        leftButton.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        keyButtons.append(leftButton)
        container.addSubview(leftButton)

        let midKeys: [String]
        switch currentMode {
        case .numbers:
            midKeys = numberRows[2]
        case .symbols:
            midKeys = symbolRows[2]
        case .letters:
            midKeys = []
        }

        // Middle character keys — fill available space between special keys with gaps
        let middle = UIStackView()
        middle.axis = .horizontal
        middle.alignment = .fill
        middle.distribution = .fillEqually
        middle.spacing = 6
        middle.translatesAutoresizingMaskIntoConstraints = false
        midKeys.forEach { key in
            let button = createKeyButton(title: key)
            button.heightAnchor.constraint(equalToConstant: 42).isActive = true
            middle.addArrangedSubview(button)
            keyButtons.append(button)
        }
        container.addSubview(middle)

        // Backspace button
        let backspaceButton = createSpecialKeyButton(title: "⌫")
        backspaceButton.addTarget(self, action: #selector(backspaceTouchDown(_:)), for: .touchDown)
        backspaceButton.addTarget(self, action: #selector(backspaceTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        keyButtons.append(backspaceButton)
        container.addSubview(backspaceButton)
        
        NSLayoutConstraint.activate([
            // Left button — left-aligned
            leftButton.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            leftButton.topAnchor.constraint(equalTo: container.topAnchor),
            leftButton.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            leftButton.widthAnchor.constraint(equalToConstant: specialKeyWidth),
            
            // Middle — fills space between special keys with iOS-style gaps
            middle.leadingAnchor.constraint(equalTo: leftButton.trailingAnchor, constant: sideGap),
            middle.trailingAnchor.constraint(equalTo: backspaceButton.leadingAnchor, constant: -sideGap),
            middle.topAnchor.constraint(equalTo: container.topAnchor),
            middle.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            
            // Backspace — right-aligned
            backspaceButton.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            backspaceButton.topAnchor.constraint(equalTo: container.topAnchor),
            backspaceButton.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            backspaceButton.widthAnchor.constraint(equalToConstant: specialKeyWidth),
        ])

        return container
    }
    
    private func createBottomRow() -> UIView {
        let containerView = UIView()
        
        // Don't use UIStackView - use explicit positioning like third row
        // This ensures exact alignment with other rows

        // ── iOS-accurate bottom row sizing ──
        // iOS bottom row uses fixed widths - 123 and emoji keys are slightly smaller than shift/backspace
        // Based on visual comparison with iOS keyboard
        let hasPeriod = shouldShowPeriodButton()
        
        // iOS measurements - based on actual iOS keyboard:
        //   Shift/backspace keys: 42pt
        //   123/ABC button: ~40pt (slightly smaller than shift/backspace)
        //   Emoji button: ~41pt (same as 123 button)
        //   Period button: ~standardKeyWidth (same as letter key)
        //   Return/Go button: With period: ~2.0x standardKeyWidth, Without period: ~2.8x standardKeyWidth (iOS exact ratios)
        //   Space bar: fills remaining width
        let specialKeyWidth: CGFloat = 42 // Shift/backspace keys
        let modeKeyWidth: CGFloat = 40 // 123/ABC key - slightly smaller than shift/backspace
        let emojiKeyWidth: CGFloat = 41 // Emoji key - same as 123 key
        let periodKeyWidth = standardKeyWidth * 1.0
        // iOS return key width - slightly wider than base ratios to match iOS exactly
        // +1.5pt adjustment (between original and +3.0 which was too large)
        let returnKeyWidth: CGFloat = hasPeriod ? (standardKeyWidth * 2.0 + 1.5) : (standardKeyWidth * 2.8 + 1.5)

        let leftModeTitle: String = (currentMode == .letters) ? "123" : "ABC"
        let leftModeButton = createSpecialKeyButton(title: leftModeTitle)
        if currentMode == .letters {
            leftModeButton.addTarget(self, action: #selector(numbersTapped), for: [.touchUpInside, .touchUpOutside])
        } else {
            leftModeButton.addTarget(self, action: #selector(lettersTapped), for: [.touchUpInside, .touchUpOutside])
        }
        leftModeButton.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        keyButtons.append(leftModeButton)
        leftModeButton.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(leftModeButton)
        NSLayoutConstraint.activate([
            leftModeButton.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            leftModeButton.topAnchor.constraint(equalTo: containerView.topAnchor),
            leftModeButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            leftModeButton.widthAnchor.constraint(equalToConstant: modeKeyWidth),
            leftModeButton.heightAnchor.constraint(equalToConstant: 42)
        ])

        // Emoji button
        let emojiButton = createSpecialKeyButton(title: "face.smiling")
        emojiButton.addTarget(self, action: #selector(emojiTapped), for: [.touchUpInside, .touchUpOutside])
        emojiButton.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
        emojiButton.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        keyButtons.append(emojiButton)
        emojiButton.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(emojiButton)
        // iOS uses 6pt spacing between 123 and emoji keys (same as other rows)
        // The bottom row spacing of 5.5pt applies to space bar area, not between 123 and emoji
        NSLayoutConstraint.activate([
            emojiButton.leadingAnchor.constraint(equalTo: leftModeButton.trailingAnchor, constant: 6.0),
            emojiButton.topAnchor.constraint(equalTo: containerView.topAnchor),
            emojiButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            emojiButton.widthAnchor.constraint(equalToConstant: emojiKeyWidth),
            emojiButton.heightAnchor.constraint(equalToConstant: 42)
        ])

        // Period button (if present) - positioned before return
        var periodButton: UIButton?
        if hasPeriod {
            periodButton = createKeyButton(title: ".")
            // Override period button actions to add special space-bar-conflict handling
            periodButton!.addTarget(self, action: #selector(periodTapped), for: [.touchUpInside, .touchUpOutside])
            periodButton!.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
            periodButton!.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
            keyButtons.append(periodButton!)
            periodButton!.translatesAutoresizingMaskIntoConstraints = false
            containerView.addSubview(periodButton!)
        }

        // Return button - right-aligned
        let returnKeyText = getReturnKeyText()
        let returnButton = createSpecialKeyButton(title: returnKeyText)
        returnButton.addTarget(self, action: #selector(returnTapped), for: [.touchUpInside, .touchUpOutside])
        returnButton.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
        returnButton.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        keyButtons.append(returnButton)
        returnButton.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(returnButton)
        
        // Position return button first (right-aligned)
        NSLayoutConstraint.activate([
            returnButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            returnButton.topAnchor.constraint(equalTo: containerView.topAnchor),
            returnButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            returnButton.widthAnchor.constraint(equalToConstant: returnKeyWidth),
            returnButton.heightAnchor.constraint(equalToConstant: 42)
        ])
        
        // Position period button (if present) before return
        if let periodBtn = periodButton {
            NSLayoutConstraint.activate([
                periodBtn.trailingAnchor.constraint(equalTo: returnButton.leadingAnchor, constant: -5.5),
                periodBtn.topAnchor.constraint(equalTo: containerView.topAnchor),
                periodBtn.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
                periodBtn.widthAnchor.constraint(equalToConstant: periodKeyWidth),
                periodBtn.heightAnchor.constraint(equalToConstant: 42)
            ])
        }
        
        // Space Bar — Position between emoji and period/return with exact spacing
        // Use trailing anchor constraint to prevent extending too far right
        let spaceButton = createSpecialKeyButton(title: "space")
        spaceButton.addTarget(self, action: #selector(spaceTapped), for: [.touchUpInside, .touchUpOutside])
        spaceButton.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
        spaceButton.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        keyButtons.append(spaceButton)
        spaceButton.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(spaceButton)
        
        // Position space bar between emoji and period (if present) or return
        // Use trailing anchor to ensure it doesn't extend beyond the correct position
        let spaceTrailingAnchor = hasPeriod ? periodButton!.leadingAnchor : returnButton.leadingAnchor
        NSLayoutConstraint.activate([
            spaceButton.leadingAnchor.constraint(equalTo: emojiButton.trailingAnchor, constant: 5.5),
            spaceButton.trailingAnchor.constraint(equalTo: spaceTrailingAnchor, constant: -5.5),
            spaceButton.topAnchor.constraint(equalTo: containerView.topAnchor),
            spaceButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            spaceButton.heightAnchor.constraint(equalToConstant: 42)
        ])

        
        return containerView
    }
    
    private func getReturnKeyText() -> String {
        switch returnKeyType {
        case .go: return "go"
        case .google: return "search"
        case .join: return "join"
        case .next: return "next"
        case .route: return "route"
        case .search: return "search"
        case .send: return "send"
        case .yahoo: return "search"
        case .done: return "done"
        case .emergencyCall: return "emergency"
        case .continue: return "continue"
        default: return "return"
        }
    }
    
    func updateReturnKeyType(_ type: UIReturnKeyType) {
        returnKeyType = type
        buildKeyboard()
    }
    
    // Key button creation — uses ForgivingButton for expanded touch area
    private func createKeyButton(title: String) -> UIButton {
        let button = ForgivingButton(type: .custom)
        button.translatesAutoresizingMaskIntoConstraints = false
        
        let displayTitle = (currentMode == .letters) ? title.uppercased() : title
        button.setTitle(displayTitle, for: .normal)
        button.accessibilityLabel = title.lowercased()
        
        button.titleLabel?.font = UIFont.systemFont(ofSize: 23, weight: .regular)
        button.backgroundColor = keyBackgroundColor  // Direct color assignment
        button.setTitleColor(keyTextColor, for: .normal)
        
        // CRITICAL: Ensure text is perfectly centered (important for period button and letter keys)
        button.contentVerticalAlignment = .center
        button.contentHorizontalAlignment = .center
        // Remove any edge insets that might offset the text
        button.contentEdgeInsets = .zero
        button.titleEdgeInsets = .zero
        button.imageEdgeInsets = .zero
        // Ensure title label is centered
        button.titleLabel?.textAlignment = .center
        
        // SPECIAL HANDLING FOR PERIOD BUTTON:
        // The period (.) is a tiny dot that needs optical alignment adjustments
        // iOS shifts it slightly to give more visual weight to the space bar
        if title == "." {
            // Store a flag so ForgivingButton.layoutSubviews can apply optical adjustment
            button.tag = 999 // Special tag for period button
        }
        
        button.layer.cornerRadius = 5
        button.layer.masksToBounds = false
        
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1.0)
        button.layer.shadowRadius = 0.0
        button.layer.shadowOpacity = 0.35
        
        // CRITICAL FOR SMOOTH TYPING:
        // Register keyTapped on BOTH .touchUpInside AND .touchUpOutside.
        // Even with ForgivingButton.point(inside:) returning true, edge cases can cause
        // .touchUpOutside to fire instead of .touchUpInside (e.g., rapid typing, finger
        // sliding). Registering on both ensures the character is ALWAYS inserted.
        button.addTarget(self, action: #selector(keyTapped(_:)), for: [.touchUpInside, .touchUpOutside])
        button.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        button.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
        
        return button
    }
    
    // Special key button — uses ForgivingButton for expanded touch area
    private func createSpecialKeyButton(title: String) -> UIButton {
        let button = ForgivingButton(type: .custom)
        button.translatesAutoresizingMaskIntoConstraints = false
        
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        
        if title == "⌫" {
            // Backspace - use SF Symbol, slightly larger to match iOS (20pt instead of 18pt)
            let deleteConfig = UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            if let image = UIImage(systemName: "delete.left", withConfiguration: deleteConfig) {
                button.setImage(image, for: .normal)
                button.tintColor = keyTextColor
            } else {
                button.setTitle(title, for: .normal)
                button.titleLabel?.font = UIFont.systemFont(ofSize: 20, weight: .semibold)
                button.setTitleColor(keyTextColor, for: .normal)
            }
        } else if title == "⇧" {
            // Shift - will be updated by updateShiftButtonAppearance
            // iOS uses full opacity but different visual treatment - use full color when off
            let symbolName = (shiftState == .off) ? "shift" : "shift.fill"
            if let image = UIImage(systemName: symbolName, withConfiguration: symbolConfig) {
                button.setImage(image, for: .normal)
                // Use full opacity for both states - iOS doesn't make shift look "dull"
                button.tintColor = keyTextColor
            } else {
                button.setTitle(title, for: .normal)
                button.titleLabel?.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
                button.setTitleColor(keyTextColor, for: .normal)
            }
        } else if title == "face.smiling" {
            // Emoji button - Use SF Symbol "face.smiling" with text color
            let symbolConfig = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
            if let symbolImage = UIImage(systemName: "face.smiling", withConfiguration: symbolConfig) {
                button.setImage(symbolImage, for: .normal)
                button.tintColor = keyTextColor
            } else {
                button.setTitle("😀", for: .normal)
                button.titleLabel?.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
                button.setTitleColor(keyTextColor, for: .normal)
            }
            
            // Ensure button content is centered
            button.contentVerticalAlignment = .center
            button.contentHorizontalAlignment = .center
            button.contentEdgeInsets = .zero
            button.imageEdgeInsets = .zero
        } else {
            // Other special keys
            button.setTitle(title, for: .normal)
            let lowerTitle = title.lowercased()
            if lowerTitle == "return" || lowerTitle == "search" || lowerTitle == "go" || 
               lowerTitle == "send" || lowerTitle == "done" || lowerTitle == "next" {
                // iOS uses regular weight at ~16pt for return/go/search keys (not bold)
                button.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .regular)
            } else {
                button.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .medium)
            }
            button.setTitleColor(keyTextColor, for: .normal)
            
            // CRITICAL: Ensure text is perfectly centered in button
            // iOS keyboards have perfectly centered text in return/go keys
            button.contentVerticalAlignment = .center
            button.contentHorizontalAlignment = .center
            button.contentEdgeInsets = .zero
            button.imageEdgeInsets = .zero
            button.titleLabel?.textAlignment = .center
            
            // SPECIAL HANDLING FOR "GO"/"RETURN" BUTTONS:
            // Uppercase text without descenders appears too high when centered by line height.
            // We need to align based on cap height instead. Add a small top offset via titleEdgeInsets
            // to nudge the text down slightly for optical centering.
            if lowerTitle == "return" || lowerTitle == "search" || lowerTitle == "go" || 
               lowerTitle == "send" || lowerTitle == "done" || lowerTitle == "next" {
                // Add 2 point top offset to account for cap height vs line height
                // This makes uppercase text appear visually centered (increased from 1.5pt)
                button.titleEdgeInsets = UIEdgeInsets(top: 2.0, left: 0, bottom: 0, right: 0)
                // Store a flag so ForgivingButton.layoutSubviews can apply cap height alignment
                button.tag = 998 // Special tag for return/go buttons
            } else {
                button.titleEdgeInsets = .zero
            }
        }
        
        button.backgroundColor = specialKeyBackgroundColor  // Direct color assignment
        
        button.layer.cornerRadius = 5
        button.layer.masksToBounds = false
        
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1.0)
        button.layer.shadowRadius = 0.0
        button.layer.shadowOpacity = 0.35
        
        button.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
        button.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        
        return button
    }
    
    // iOS-style touch handling: click sound + haptic on touchDown, text commit on touchUp
    @objc private func keyTouchDown(_ sender: UIButton) {
        pressedKeys.insert(sender)
        
        // iOS-optimized feedback timing for natural feel
        // Haptic first for immediate tactile response
        selectionFeedback?.selectionChanged()
        
        // Sound with slight delay to prevent audio conflicts
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.005) {
            self.delegate?.playKeyClickSound()
        }
        
        // Pre-calculate pressed colors for immediate update (performance optimization)
        let pressedColor: UIColor
        if let cachedColor = traitCollection.userInterfaceStyle == .dark ? pressedKeyColorDark : pressedKeyColor {
            pressedColor = cachedColor
        } else {
            // Calculate and cache colors on first use
            pressedColor = traitCollection.userInterfaceStyle == .dark 
                ? UIColor(white: 0.4, alpha: 1.0)
                : UIColor(white: 0.85, alpha: 1.0)
        if traitCollection.userInterfaceStyle == .dark {
                pressedKeyColorDark = pressedColor
        } else {
                pressedKeyColor = pressedColor
            }
        }
        
        // iOS-style immediate visual feedback with optimized animation
        UIView.performWithoutAnimation {
            sender.backgroundColor = pressedColor
        }
        
        // Improved fallback restore with shorter timeout for better responsiveness
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self, weak sender] in
            guard let self = self, let sender = sender, self.pressedKeys.contains(sender) else { return }
            self.restoreKeyColor(sender)
            self.pressedKeys.remove(sender)
        }
        
        // Show preview for letter keys
        if currentMode == .letters, let title = sender.title(for: .normal), 
           title.count == 1, title != "⌫" && title != "⇧",
           bounds.width > 0 && bounds.height > 0 {
            showKeyPreview(for: sender, text: title)
        }
    }
    
    @objc private func keyTouchUp(_ sender: UIButton) {
        pressedKeys.remove(sender)
        
        // Smooth key release animations for iOS-like feel
        hideKeyPreview()
        
        // Gentle color restoration with subtle animation
        UIView.animate(withDuration: 0.15, delay: 0, options: [.curveEaseOut, .allowUserInteraction], animations: {
            self.restoreKeyColor(sender)
        })
    }
        
    private func restoreKeyColor(_ sender: UIButton) {
        // Determine if special key by checking title
        let title = sender.title(for: .normal) ?? ""
        let hasImage = sender.image(for: .normal) != nil
        let isSpecial = (title == "space" || title == "return" || title == "go" ||
                        title == "search" || title == "send" || title == "done" ||
                        title == "next" || title == "123" || title == "ABC" ||
                        title == "#+=" || title == "⇧" || title == "⌫" ||
                        title == "face.smiling" || hasImage)
        
        sender.backgroundColor = isSpecial ? specialKeyBackgroundColor : keyBackgroundColor
    }
    
    private func showKeyPreview(for button: UIButton, text: String) {
        // Reuse existing preview instead of creating new one (performance optimization)
        if keyPreview == nil {
        keyPreview = KeyPreviewView()
        }
        
        // Update preview with new text and position
        keyPreview?.setText(text)
        // Use the key's own colors for the preview (theme-aware)
        keyPreview?.setColors(background: keyBackgroundColor, text: keyTextColor)
        keyPreview?.show(above: button, in: self)
        currentPreviewButton = button
    }
    
    private func hideKeyPreview() {
        keyPreview?.hide()
        // Don't nil the preview - reuse it for next touch
        currentPreviewButton = nil
    }
    
    @objc private func keyTapped(_ sender: UIButton) {
        let currentTime = CACurrentMediaTime()
        
        // Determine the key to send
        var keyToSend: String
        if currentMode == .letters {
            if let accessibilityLabel = sender.accessibilityLabel {
                let baseKey = accessibilityLabel
                keyToSend = isShifted ? baseKey.uppercased() : baseKey
            } else {
                keyToSend = sender.title(for: .normal) ?? ""
            }
        } else {
            keyToSend = sender.title(for: .normal) ?? ""
        }
        
        // iOS-style double-tap prevention for better accuracy
        // Allow rapid typing but prevent accidental double characters
        let timeSinceLastTap = currentTime - lastKeyTapTime
        if timeSinceLastTap < 0.05 && keyToSend == lastTappedKey {
            // Too fast, likely accidental double-tap - ignore
            return
        }
        
        lastKeyTapTime = currentTime
        lastTappedKey = keyToSend
        
        // Update sequence tracking for predictive modeling
        recentKeySequence.append(keyToSend)
        if recentKeySequence.count > 6 {
            recentKeySequence.removeFirst()
        }
        
        delegate?.didTapKey(keyToSend)
        
        if currentMode == .letters && isShifted && shiftState != .capsLock {
            shiftState = .off
            updateShiftState()
        }
        
        // Auto-capitalize check after character insertion
        // Use async to ensure textDocumentProxy context is updated
        DispatchQueue.main.async { [weak self] in
            self?.checkAutoCapitalize()
        }
    }
    
    @objc private func spaceTapped() {
        let currentTime = Date().timeIntervalSince1970
        let timeSinceLastTap = currentTime - lastSpaceTapTime
        
        if timeSinceLastTap < 0.5 && timeSinceLastTap > 0 {
            // Double-space-for-period: delete trailing space, insert period + space
            delegate?.didTapBackspace()
            delegate?.didTapKey(".")
            delegate?.didTapSpace()
            lastSpaceTapTime = 0
        } else {
            delegate?.didTapSpace()
            lastSpaceTapTime = currentTime
        }
        
        // Auto-capitalize after space (important for ". " → capitalize)
        DispatchQueue.main.async { [weak self] in
            self?.checkAutoCapitalize()
        }
    }
    
    @objc private func returnTapped() {
        // Medium haptic for return (distinct from letter keys, matching iOS)
        let mediumFeedback = UIImpactFeedbackGenerator(style: .medium)
        mediumFeedback.impactOccurred()
        delegate?.didTapReturn()
        
        // Auto-capitalize after newline
        DispatchQueue.main.async { [weak self] in
            self?.checkAutoCapitalize()
        }
    }
    
    @objc private func backspaceTouchDown(_ sender: UIButton) {
        keyTouchDown(sender) // This already plays click sound + haptic
        backspaceRepeatCount = 0
        
        delegate?.didTapBackspace()
        // Use medium haptic for backspace (distinct from regular keys, matching iOS)
        impactFeedback?.impactOccurred()
        
        backspaceTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in
            self?.startBackspaceRepeat()
        }
    }
    
    private func startBackspaceRepeat() {
        backspaceTimer?.invalidate()
        
        let interval: TimeInterval = backspaceRepeatCount > 10 ? 0.04 : 0.08
        
        backspaceTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.delegate?.didTapBackspace()
            self.backspaceRepeatCount += 1
            
            if self.backspaceRepeatCount == 10 {
                self.startBackspaceRepeat()
            }
        }
    }
    
    @objc private func backspaceTouchUp(_ sender: UIButton) {
        backspaceTimer?.invalidate()
        backspaceTimer = nil
        backspaceRepeatCount = 0
        keyTouchUp(sender)
    }
    
    @objc private func shiftTapped() {
        let currentTime = Date().timeIntervalSince1970
        let timeSinceLastTap = currentTime - lastShiftTapTime
        
        if timeSinceLastTap < 0.5 && timeSinceLastTap > 0 {
            shiftState = .capsLock
            lastShiftTapTime = 0
        } else {
            switch shiftState {
            case .off:
                shiftState = .on
            case .on:
                shiftState = .off
            case .capsLock:
                shiftState = .off
            }
            lastShiftTapTime = currentTime
        }
        
        updateShiftState()
        delegate?.didTapShift()
    }
    
    @objc private func numbersTapped() {
        currentMode = .numbers
        shiftState = .off
        buildKeyboard()
        delegate?.didTapNumbers()
    }
    
    @objc private func lettersTapped() {
        currentMode = .letters
        shiftState = .off
        buildKeyboard()
        delegate?.didTapLetters()
        // Auto-capitalize when switching back to letters mode
        checkAutoCapitalize()
    }
    
    @objc private func symbolsTapped() {
        currentMode = .symbols
        shiftState = .off
        buildKeyboard()
        delegate?.didTapSymbols()
    }

    @objc private func nextKeyboardTapped() {
        delegate?.didTapNextKeyboard()
    }
    
    @objc private func emojiTapped() {
        toggleEmojiPicker()
    }
    
    private func toggleEmojiPicker() {
        isShowingEmojiPicker.toggle()
        
        // Update keyboard height — emoji keyboard is significantly taller than regular on iOS
        let newHeight: CGFloat = isShowingEmojiPicker ? 370 : 291
        heightConstraint?.constant = newHeight
        
        // Notify delegate about emoji picker state change
        delegate?.emojiPickerToggled(isShowing: isShowingEmojiPicker)
        
        UIView.animate(withDuration: 0.2, animations: {
            if self.isShowingEmojiPicker {
                self.keyboardContainerView.alpha = 0
                self.emojiPickerView.isHidden = false
                self.emojiPickerView.alpha = 1
            } else {
                self.keyboardContainerView.alpha = 1
                self.emojiPickerView.alpha = 0
            }
            self.superview?.layoutIfNeeded()
        }) { _ in
            if !self.isShowingEmojiPicker {
                self.emojiPickerView.isHidden = true
            }
        }
    }
    
    @objc private func periodTapped() {
        delegate?.didTapPeriod()
    }
    
    private func updateShiftState() {
        for button in keyButtons {
            // Identify shift button by its accessibility label or image
            if let accessibilityLabel = button.accessibilityLabel, accessibilityLabel == "shift" {
                updateShiftButtonAppearance(button)
            } else if let title = button.title(for: .normal), title.count == 1 && title.rangeOfCharacter(from: CharacterSet.letters) != nil {
                let newTitle = isShifted ? title.uppercased() : title.lowercased()
                button.setTitle(newTitle, for: .normal)
            }
        }
    }
    
    private func updateShiftButtonAppearance(_ button: UIButton) {
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        let symbolName: String
        
        // Remove existing caps lock indicator if any
        button.viewWithTag(999)?.removeFromSuperview()
        
        switch shiftState {
        case .off:
            symbolName = "shift"
            button.tintColor = keyTextColor
            button.backgroundColor = specialKeyBackgroundColor
        case .on:
            symbolName = "shift.fill"
            button.tintColor = keyTextColor
            button.backgroundColor = keyBackgroundColor // White bg like iOS when shift is on
        case .capsLock:
            symbolName = "capslock.fill"
            button.tintColor = keyTextColor
            button.backgroundColor = keyBackgroundColor // White bg for caps lock too
        }
        
        if let image = UIImage(systemName: symbolName, withConfiguration: symbolConfig) {
            button.setImage(image, for: .normal)
            button.setTitle(nil, for: .normal)
        } else {
            button.setTitle("⇧", for: .normal)
            button.setImage(nil, for: .normal)
            button.setTitleColor(button.tintColor, for: .normal)
        }
    }
    
    func updateForKeyboardType(_ type: UIKeyboardType) {
        keyboardType = type
        switch type {
        case .numberPad, .phonePad, .decimalPad:
            currentMode = .numbers
            shiftState = .off
        default:
            currentMode = .letters
            shiftState = .off
        }
        buildKeyboard()
    }
    
    /// Called by the view controller to trigger auto-capitalization on keyboard appearance
    func performAutoCapitalizationCheck() {
        checkAutoCapitalize()
    }
    
    /// Auto-capitalization: checks the text context and enables shift if needed
    /// Mirrors iOS behavior — capitalizes at sentence start, after ".", "!", "?", newlines
    private func checkAutoCapitalize() {
        // Only applies in letters mode when shift is not already on
        guard currentMode == .letters, shiftState == .off else { return }
        if delegate?.shouldAutoCapitalize() == true {
            shiftState = .on
            updateShiftState()
        }
    }
    
    private func shouldShowPeriodButton() -> Bool {
        return keyboardType == .URL || keyboardType == .emailAddress || keyboardType == .webSearch
    }
    
    // FIXED: Simplified theme application with gradient support
    func applyTheme(background: UIColor, text: UIColor, link: UIColor, keyColor: UIColor? = nil, backgroundType: String? = nil, backgroundGradient: String? = nil) {
        // Apply theme to emoji picker if it exists
        emojiPickerView?.applyTheme(background: background, text: text)
        
        // Check if this is a monochrome gradient theme
        let isMonochromeGradient = backgroundType == "gradient" && 
                                   backgroundGradient != nil && 
                                   backgroundGradient!.contains("#000000") && 
                                   backgroundGradient!.contains("#ffffff")
        
        if isMonochromeGradient {
            // Remove solid background color
            backgroundView.backgroundColor = .clear
            
            // Create or update gradient layer
            if gradientLayer == nil {
                gradientLayer = CAGradientLayer()
                backgroundView.layer.insertSublayer(gradientLayer!, at: 0)
            }
            
            // Configure diagonal gradient: top-right (black) to bottom-left (white)
            gradientLayer!.colors = [UIColor.black.cgColor, UIColor.white.cgColor]
            gradientLayer!.startPoint = CGPoint(x: 1.0, y: 0.0) // Top-right
            gradientLayer!.endPoint = CGPoint(x: 0.0, y: 1.0)   // Bottom-left
            gradientLayer!.locations = [0.0, 1.0]
            
            // Update gradient frame when layout changes
            DispatchQueue.main.async { [weak self] in
                self?.updateGradientFrame()
            }
            
            // Apply position-based text colors to keys
            applyMonochromeKeyColors()
        } else {
            // Remove gradient if it exists
            gradientLayer?.removeFromSuperlayer()
            gradientLayer = nil
            
            // Use solid background
            keyTextColor = text
            backgroundView.backgroundColor = background
            
            // Set key background color from theme
            if let keyColor = keyColor {
                keyBackgroundColor = keyColor
            } else {
                // Fallback to default if keyColor not provided
                keyBackgroundColor = UIColor(white: 0.27, alpha: 1.0)
            }
            
            // Update all buttons with standard colors
            for button in keyButtons {
                let title = button.title(for: .normal) ?? ""
                let hasImage = button.image(for: .normal) != nil
                let isSpecial = (title == "space" || title == "return" || title == "go" ||
                                title == "search" || title == "send" || title == "done" ||
                                title == "next" || title == "123" || title == "ABC" ||
                                title == "#+=" || title == "⇧" || title == "⌫" ||
                                title == "face.smiling" || hasImage)
                
                button.backgroundColor = isSpecial ? specialKeyBackgroundColor : keyBackgroundColor
                button.setTitleColor(keyTextColor, for: .normal)
                button.tintColor = keyTextColor
            }
        }
        
        // Update shift button
        for button in keyButtons {
            if button.accessibilityLabel == "shift" {
                updateShiftButtonAppearance(button)
            }
        }
    }
    
    private func updateGradientFrame() {
        guard let gradientLayer = gradientLayer else { return }
        gradientLayer.frame = backgroundView.bounds
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        updateGradientFrame()
        // Re-apply monochrome colors after layout changes
        if gradientLayer != nil {
            applyMonochromeKeyColors()
        }
    }
    
    private func applyMonochromeKeyColors() {
        guard let gradientLayer = gradientLayer, gradientLayer.superlayer != nil else { return }
        guard !keyButtons.isEmpty else { return }
        
        let keyboardBounds = backgroundView.bounds
        guard keyboardBounds.width > 0 && keyboardBounds.height > 0 else { return }
        
        for button in keyButtons {
            // Get button center position relative to keyboard
            let buttonCenterInButton = CGPoint(x: button.bounds.midX, y: button.bounds.midY)
            let buttonCenter = button.convert(buttonCenterInButton, to: backgroundView)
            
            // Normalize position to 0-1 range
            let normalizedX = buttonCenter.x / keyboardBounds.width
            let normalizedY = buttonCenter.y / keyboardBounds.height
            
            // Calculate position along diagonal: top-right = 0 (black), bottom-left = 1 (white)
            // Diagonal position = (1 - normalizedX) + normalizedY, normalized to 0-1
            let diagonalPos = ((1.0 - normalizedX) + normalizedY) / 2.0
            
            // Determine if key is in dark or light area
            // Threshold: < 0.5 = dark area (white text), >= 0.5 = light area (black text)
            let isDarkArea = diagonalPos < 0.5
            
            // Set text color based on position
            let textColor = isDarkArea ? UIColor.white : UIColor.black
            
            // Set key background color - slightly lighter/darker than gradient for contrast
            let keyBgColor: UIColor
            if isDarkArea {
                // Dark area - use slightly lighter dark gray
                keyBgColor = UIColor(white: 0.2, alpha: 0.8)
            } else {
                // Light area - use slightly darker light gray
                keyBgColor = UIColor(white: 0.9, alpha: 0.8)
            }
            
            button.backgroundColor = keyBgColor
            button.setTitleColor(textColor, for: .normal)
            button.tintColor = textColor
            
            // Special handling for return key (use link color if provided, but ensure contrast)
            let title = button.title(for: .normal) ?? ""
            if title == "return" || title == "go" || title == "search" || 
               title == "send" || title == "done" || title == "next" {
                // Return key should stand out - use a contrasting color
                if isDarkArea {
                    button.backgroundColor = UIColor(white: 0.3, alpha: 0.9)
                } else {
                    button.backgroundColor = UIColor(white: 0.7, alpha: 0.9)
                }
            }
        }
    }
}

private extension UIColor {
    func adjustBrightness(by delta: CGFloat) -> UIColor {
        var h: CGFloat = 0
        var s: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        if getHue(&h, saturation: &s, brightness: &b, alpha: &a) {
            return UIColor(hue: h, saturation: s, brightness: min(max(b + delta, 0), 1), alpha: a)
        }
        return self
    }
}

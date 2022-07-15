// tiny side thing for creating menus/menu buttons/menubars/etc.

// menu currently open 
let activeMenu = null;

// default action function for menu
function defaultAction(){
	// TODO: should console warn?
	//console.warn("No action is defined for this button/prompt.  You should define one in the itemActions property when constructing this Menu.");
}


/**
	*	@brief A prompt similar to a menu, but much more customizable
*/
class Prompt {
	/**
		*	@brief Constructs a new Prompt from the options object provided
		*
		*	options: {
		*		killOnHide: (boolean), // if this prompt should be killed when hidden (good for one-time prompts)
		*		onHide: function(){}, // executed after prompt is hidden (bound to this instance)
		*		htmlContent: <html>, // string html for the prompt
		*		args: [arg1, arg2, ...], // arguments for the js function
		*		js: function(arg1, arg2, ...){}, // js function which runs when the prompt is created, for setting event listeners, etc.  it will be bound to the class instance, so every attribute/method can be accessed within this in the function
		*	}
	*/
	constructor(options){
		this.htmlContent = options.htmlContent || "";

		this.itemContainer = document.createElement("div");
		this.itemContainer.classList.add("menu-item-container");
		this.itemContainer.style.display = "block";
		this.itemContainer.insertAdjacentHTML("afterbegin", this.htmlContent);
		this.hide();
		
		// push item container into document
		document.body.appendChild(this.itemContainer);
		
		// unlike a menu, prompt doesn't close or open by default under normal circumstances, it's expected that the prompt will have some sort of button or something that closes it
		if(options.js){
			options.js.bind(this)(...(options.args || []));
		}
		
		if(options.onHide){
			this.onHide = options.onHide;
			
			this.onHide.bind(this);
		}
		
		this.killOnHide = options.killOnHide;
	}
	
	// show the prompt at the coordinates
	show(x, y){
		this.itemContainer.style.display = "block";
		this.itemContainer.style.top = y + "px";
		this.itemContainer.style.left = x + "px";
		
		this.visible = true;
		
		if(activeMenu) activeMenu.hide();
		
		activeMenu = this;
	}
	
	// hide the prompt
	hide(){
		this.itemContainer.style.display = "none";
		
		this.visible = false;
		
		if(activeMenu == this) activeMenu = null;
		
		if(this.onHide) this.onHide();
		
		if(this.killOnHide) this.kill();
	}
	
	// permanently remove this prompt's html from the page
	kill(){
		this.itemContainer.remove();
	}
}

/**
	*	@brief A menu similar to the right-click context menu
	*
	*	@todo subclass of Prompt?
*/
class Menu {
	/**
		*	@brief Constructs a new Menu from the options object provided
		*
		*	options: {
		*		width: "", // override default width of 150px
		*		height: "", // if undefined, the height will expand dynamically depending on the number of elements.  if defined, the menu will have this set height and will enable the scrollbar for overflow.
		*		itemNames: ["", ""], // ordered list of the item names on the context menu
		*		itemActions: [ // ordered list of the actions taken when items are pressed
		*			function(){
		*				// item action code
		*			}
		*		]
		*	}
	*/
	constructor(options){
		this.itemContainer = document.createElement("div"); // menu list of actions
		
		// default arguments to actions
		this.args = [];
		
		// stylize item container
		this.itemContainer.classList.add("menu-item-container");
		this.hide(); // hide initially
		
		this.width = options.width;
		this.height = options.height || "";
		
		// set height, if provided
		if(this.height.length > 0){
			// set container height to provided value
			this.itemContainer.style.height = this.height;
			
			// enable scrollbar
			this.itemContainer.style["overflow-y"] = "auto";
			this.itemContainer.style["overflow-x"] = "hidden"; // disable for x scrolling
		}
		
		// create menu items
		this.itemNames = [];
		this.addItems(options.itemNames, options.itemActions);
		
		// push item container into document
		document.body.appendChild(this.itemContainer);
		
		this.suppressHide = false;
		
		// manage click events
		document.body.addEventListener("mouseup", function(e){
			// temporary override to suppress the hide action
			// note: fixed spelling of "supress" but it's probably still in a few commits.  shhhh
			if(this.suppressHide){
				this.suppressHide = false;
				return;
			}
			
			// hide the menu
			this.hide();
		}.bind(this));
	}
	
	// change item names without changing item actions.  better than reconstructing the menu each time you want to change the names
	// if newNames is too short, it won't change the remaining names.  if newNames is too long, it will ignore the extra names provided
	changeItemNames(newNames){
		// loop by whichever is the smallest number (to avoid overwrites)
		for(let i = 0; i < Math.min(this.itemContainer.children.length, newNames.length); i++){
			let item = this.itemContainer.children[i];
			
			item.textContent = newNames[i];
			this.itemNames[i] = newNames[i];
		}
	}
	
	// override item names and item actions.
	// similar to changeItemNames but also changes actions
	// if destructive is false/undefined, then the behavior is:
	// if newNames is too short, it won't change the remaining names.  if newNames is too long, it will ignore the extra names provided
	// if destructive is true, then the behavior is:
	// if newNames is too short, delete any remaining items.  if newNames is too long, expand the amount of items
	// TODO: this function needs some cleaning
	changeItems(newNames, newActions, destructive){
		// prevent bad iterator below if newActions is undefined
		newActions = newActions || [];
		
		let length = destructive ? newNames.length : Math.min(this.itemContainer.children.length, newNames.length);
		
		// create menu items
		for(let i = 0; i < length; i++){
			// create button
			let itemButton = this.createItemButton(newNames[i], newActions[i]);
			
			// grab old item and replace, if it exists
			// otherwise append the item and name
			if(i < this.itemContainer.children.length){
				let item = this.itemContainer.children[i];
				
				this.itemContainer.replaceChild(itemButton, item);
				
				// replace item name
				this.itemNames[i] = newNames[i];
			} else {
				this.itemContainer.appendChild(itemButton);
				
				this.itemNames.push(newNames[i]);
			}
		}
		
		// if there's any items left that we don't want, get rid of them
		while(newNames.length < this.itemContainer.children.length){
			this.itemContainer.removeChild(this.itemContainer.children[newNames.length]);
		}
	}
	
	// create an item button from a name and action
	createItemButton(name, action){
		// create button
		let itemButton = document.createElement("button");
		
		// bind action to this instance
		action = (action || defaultAction).bind(this);
		
		// add css
		itemButton.classList.add("menu-item");
		
		// override width
		if(this.width){
			itemButton.style.width = this.width;
		}
		
		// stylize
		itemButton.textContent = name;
		itemButton.addEventListener("mouseup", e => {
			action(e, ...(this.args || []));
		});
		
		return itemButton;
	}
	
	// insert items at a particular index, with 0 being the beginning and the length of itemNames-1 being the end
	insertItems(index, newNames, newActions){
		// prevent bad iterator below if newActions is undefined
		newActions = newActions || [];
		
		// create menu items
		for(let i = 0; i < newNames.length; i++){
			// grab button
			let itemButton = this.createItemButton(newNames[i], newActions[i]);
			
			// insert button before index
			let indexNode = this.itemContainer.children[index];
			
			if(!indexNode){
				console.error("Bad index for insertItems");
				return;
			}
			
			// because indexNode is moved forward each time, this will work for every new button
			this.itemContainer.insertBefore(itemButton, indexNode);
		}
	}
	
	// add items to this menu
	// if newActions is too short or undefined, the default action is used for the remaining names
	// if newActions is too long, extra actions are ignored
	addItems(newNames, newActions){
		// prevent bad iterator below if newActions is undefined
		newActions = newActions || [];
		
		// create menu items
		for(let i = 0; i < newNames.length; i++){
			// grab button
			let itemButton = this.createItemButton(newNames[i], newActions[i]);
			
			// add to end of itemContainer
			this.itemContainer.appendChild(itemButton);
			
			// add to item names
			this.itemNames.push(name);
		}
	}
	
	// show the menu at the coordinates
	// args = array of any arguments to pass to function actions (can be handy for ensuring that menus are acting on the proper object)
	show(x, y, args){
		// set args
		this.args = args;
		
		this.itemContainer.style.display = "flex";
		this.itemContainer.style.top = y + "px";
		this.itemContainer.style.left = x + "px";
		
		this.visible = true;
		
		if(activeMenu) activeMenu.hide();
		
		activeMenu = this;
	}
	
	// hide the menu
	hide(){
		this.itemContainer.style.display = "none";
		
		this.visible = false;
		
		if(activeMenu == this) activeMenu = null;
	}
	
	// permanently remove this menu's html from the page
	kill(){
		this.itemContainer.remove();
	}
}

/**
	*	@brief A menu which can be displayed as a result of clicking a menu button.  Despite being called just a Menu, Menus contain both their menu items and the button which instantiates the menu.  Unlike Menubars, these don't need an element to build off of.
*/
class MenuButton {
	/**
		*	@brief Constructs a new Menu from the options
		*
		*	either:
		*	
		*	options: {
		*		name: "", // name of the button which, when clicked, shows the menu items.
		*		menu: Menu, // the menu object to bind to this button (show when button is clicked)
		*	}
		*	
		*	OR: 
		*	
		*	options: {
		*		name: "", // name of the button which, when clicked, shows the menu items.
		*		itemNames: ["", ""], // ordered list of the item names which will appear when the menu button is clicked
		*		itemActions: [ // ordered list of the functions, where the function body is the action taken when the item at the same position in itemNames is clicked
		*			function(){
		*				// item action code
		*			}
		*		],
		* }
	*/
	constructor(options){
		// store simple vars
		this.name = options.name;
		
		// create DOM objects
		this.mainButton = document.createElement("button"); // initiating menu button
		
		// stylize main button
		this.mainButton.textContent = this.name;
		this.mainButton.classList.add("menubar-item");
		
		// create/cache the menu
		this.menu = options.menu || new Menu(options);
		
		// checks to see if 
		this.justClicked = false;
		
		// menu button logic
		this.mainButton.addEventListener("mouseup", function(e){
			// enable suppress hide
			this.menu.suppressHide = true;
			
			// show the menu
			this.show(e.clientX, e.clientY);
		}.bind(this));
	}
	
	get visible(){
		return this.menu.visible;
	}
	
	// show the menu at the coordinates
	show(x, y){
		this.menu.show(x, y);
	}
	
	// hide the menu
	hide(){
		this.menu.hide();
	}
};

/**
	*	@brief Menubar class which acts as a collection of Menus.  
*/
class Menubar {
	/**
		*	@brief Constructs a new Menubar from an existing div element.
		*
		*	This can only use existing div elements because it's easier to write code for.
		*
		*	@param menuContainer div element (or id of div element) in which the menubar will be contained
		*	@param options table of options, described below:
		*	
		*	options: {
		*		direction: "", // either "horizontal" (default) or "vertical", which is how the menu will be displayed.  the menubar is only constructed once, so changing this value after it's been created has no effect
		*		items: [], // an array of Menu items.  these are displayed in either left-right order or top-down order depending on options.direction
		*		color: "", // a valid color for css
		*		size: 0, // behavior depends on the direction, when horizontal this is the height in pixels, when vertical this is the width in pixels.  If horizontal, the menu will default to being as tall as the button elements, but when vertical, the menu will default to be the width of the page
		*	}
	*/
	constructor(menuContainer, options){
		if(menuContainer == null){
			return console.error("Menubar can't be created without a <div> element (does not have to exist in DOM)");
		}
		
		// assign div element
		this.menuContainer = typeof menuContainer == "string" ? document.getElementById(menuContainer) : menuContainer;
		
		// parse options
		this.direction = options.direction || "horizontal";
		
		// construct menu bar //
		
		// stylize
		// styles are defined in styles/menubar/
		this.menuContainer.classList.add("menubar-" + this.direction);
		this.menuContainer.style["background-color"] = options.color || "white";
		if(options.size){
			if(this.direction == "horizontal"){
				this.menuContainer.style["height"] = options.size + "px";
			} else if(this.direction == "vertical"){
				this.menuContainer.style["width"] = options.size + "px";
			}
		}
		
		// add Menu items
		for(let i = 0; i < options.items.length; i++){
			this.addMenuButton(options.items[i]);
		}
	}
	
	/**
		*	@brief Add a new MenuButton to this Menubar
		*
		*	This method can either be called with a Menu object and no options object, or the parameters for constructing a Menu object as a table
		*
		*	@param menu either an instance of a Menu object or an object containing the parameters for the Menu constructor (in which case, a new Menu object will be constructed)
	*/
	addMenuButton(menu){
		// constructed menu item
		let item;
		
		// check if menu needs to be constructed 
		if( !(menu instanceof MenuButton) ){
			item = new MenuButton(menu);
		} else {
			item = menu;
		}
		
		// push item's dom element to menubar's div element (stylizing then covered by css)
		this.menuContainer.appendChild(item.mainButton);
	}
};
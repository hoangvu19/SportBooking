import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Edit3, Plus, Search, Users, Mail, MapPin, Shield, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';
import { useAdminSearch } from '../../contexts/AdminSearchContext';

function Modal({ open, onClose, title, children }) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
			<div className="bg-white rounded-lg shadow-md w-full max-w-md overflow-hidden transform transition-all animate-slideUp">
				<div className="px-6 py-4 border-b border-gray-200 bg-white flex justify-between items-center">
					<h3 className="text-lg font-semibold text-gray-900">{title}</h3>
					<button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
				</div>
				<div className="p-5 max-h-96 overflow-y-auto">{children}</div>
			</div>
		</div>
	);
}

function InputField({ label, type = 'text', value, onChange, placeholder, disabled, showPassword, onTogglePassword, autoComplete }) {
	return (
		<div className="mb-4">
			<label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
			<div className="relative">
				<input
					type={type === 'password' && !showPassword ? 'password' : 'text'}
					placeholder={placeholder}
					value={value}
					onChange={onChange}
					autoComplete={autoComplete}
					disabled={disabled}
					className={`w-full px-3 py-2 rounded-md border border-gray-300 transition-colors ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white focus:border-blue-500 focus:ring-0'} outline-none`}
				/>
				{type === 'password' && (
					<button type="button" onClick={onTogglePassword} className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 transition">
						{showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
					</button>
				)}
			</div>
		</div>
	);
}

function SelectField({ label, value, onChange, options, disabled }) {
	const { t } = useI18n();
	return (
		<div className="mb-4">
			<label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
			<select
				value={value}
				onChange={onChange}
				disabled={disabled}
				className={`w-full px-4 py-2.5 rounded-lg border-2 transition-all ${disabled ? 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-600' : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'} outline-none`}
			>
				<option value="">{t('admin.accounts.selectRole', '-- Select role --')}</option>
				{options.map(opt => (
					<option key={opt.id} value={opt.id}>{opt.name}</option>
				))}
			</select>
		</div>
	);
}

function MultiRoleSelector({ label, selectedRoles, availableRoles, onAddRole, onRemoveRole }) {
	const { t } = useI18n();
	const [showDropdown, setShowDropdown] = useState(false);
	
	const availableToAdd = availableRoles.filter(role => !selectedRoles.includes(role.RoleName));
	
	return (
		<div className="mb-4">
			<label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
			<div className="space-y-2">
				{/* Selected roles */}
				<div className="flex flex-wrap gap-2 min-h-[40px] p-2 border-2 border-gray-300 rounded-lg bg-white">
					{selectedRoles.length > 0 ? (
						selectedRoles.map((roleName, idx) => (
							<span
								key={idx}
								className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
									roleName === 'Admin' ? 'bg-red-100 text-red-700 border border-red-300' :
									roleName === 'Owner' ? 'bg-purple-100 text-purple-700 border border-purple-300' :
									'bg-green-100 text-green-700 border border-green-300'
								}`}
							>
								{roleName}
								<button
									type="button"
									onClick={() => onRemoveRole(roleName)}
									className="ml-1 hover:bg-black/10 rounded-full p-0.5"
								>
									×
								</button>
							</span>
						))
					) : (
						<span className="text-gray-400 text-sm">{t('admin.accounts.noRoles', 'No roles assigned')}</span>
					)}
				</div>
				
				{/* Add role dropdown */}
				{availableToAdd.length > 0 && (
					<div className="relative">
					<button
						type="button"
						onClick={() => setShowDropdown(!showDropdown)}
						className="w-full px-4 py-2 text-left border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-sm font-medium text-gray-600"
					>
						+ {t('admin.accounts.addRole', 'Add Role')}
					</button>						{showDropdown && (
							<div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg">
								{availableToAdd.map((role) => (
									<button
										key={role.RoleID}
										type="button"
										onClick={() => {
											onAddRole(role.RoleName);
											setShowDropdown(false);
										}}
										className="w-full px-4 py-2 text-left hover:bg-blue-50 transition text-sm"
									>
										{role.RoleName}
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function StatCard({ icon: Icon, label, value, color }) {
		return (
			<div className={`${color} rounded-xl p-4 text-white shadow-lg`}>
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm opacity-90">{label}</p>
						<p className="text-2xl font-bold mt-1">{value}</p>
					</div>
					{/* Icon hiển thị đúng */}
					{Icon && <Icon size={32} className="opacity-30" />}
				</div>
			</div>
		);
}

export default function ManageAccounts() {
	const { t } = useI18n();
	const { searchQuery } = useAdminSearch();
	const [accounts, setAccounts] = useState([]);
	const [roles, setRoles] = useState([]);
	const [areas, setAreas] = useState([]);
	const [loading, setLoading] = useState(false);
	const [showAdd, setShowAdd] = useState(false);
	const [showEdit, setShowEdit] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [showPassword, setShowPassword] = useState(false);
	const itemsPerPage = 8;
	const [form, setForm] = useState({ username: '', fullName: '', email: '', password: '', role: '', gender: 'male', address: '' });
	const [editForm, setEditForm] = useState(null);

	useEffect(() => {
	fetchRoles();
	fetchAccounts();
	fetchAreas();
	async function fetchAreas() {
		try {
			const res = await authAPI.getAreas();
			if (res?.success && Array.isArray(res.data)) setAreas(res.data);
			else toast.error(t('admin.accounts.loadAreasError', 'Cannot load area list'));
		} catch {
			toast.error(t('admin.accounts.loadAreasError', 'Cannot load area list'));
		}
	}
	}, []);

	async function fetchRoles() {
		try {
			const res = await authAPI.getRoles();
			if (res?.success && Array.isArray(res.data)) setRoles(res.data);
			} catch {
				toast.error(t('admin.accounts.loadRolesError', 'Cannot load roles list'));
			}
	}

	async function fetchAccounts() {
		setLoading(true);
		try {
			const res = await authAPI.getAccounts();
			if (res?.success) setAccounts(res.data || []);
			else toast.error(t('admin.accounts.loadAccountsError', 'Cannot load accounts list'));
			} catch {
				toast.error(t('admin.accounts.loadAccountsError', 'Cannot load accounts list'));
			} finally {
			setLoading(false);
		}
	}

	async function handleCreate() {
		if (!form.username || !form.password || !form.fullName || !form.email) {
			toast.error(t('admin.accounts.requiredFields', 'Please fill in all required fields'));
			return;
		}
		setLoading(true);
		try {
			const res = await authAPI.createAccount(form);
			if (res?.success) {
				toast.success(t('admin.accounts.createSuccess', 'Account created successfully!'));
				setShowAdd(false);
				setShowPassword(false);
				setForm({ username: '', fullName: '', email: '', password: '', role: '', gender: 'male', address: '' });
				await fetchAccounts();
			} else {
				toast.error(res?.message || t('admin.accounts.createError', 'Cannot create account'));
			}
			} catch {
				toast.error(t('admin.accounts.createError', 'Cannot create account'));
			} finally {
			setLoading(false);
		}
	}

	function handleEdit(account) {
		// Support both PascalCase and camelCase field names
		const accountRoles = account.Roles || account.roles || [];
		const accountAddress = account.Address || account.address || '';
		const accountGender = account.Gender || account.gender || 'male';
		
		setEditForm({
			id: account.AccountID,
			username: account.Username || '',
			fullName: account.FullName || '',
			email: account.Email || '',
			gender: accountGender,
			address: accountAddress,
			roles: accountRoles.map(r => r.RoleName || r.roleName)
		});
		setShowEdit(true);
	}

	async function handleUpdate() {
		if (!editForm?.fullName || !editForm?.email) {
			toast.error(t('admin.accounts.requiredFields', 'Please fill in all required fields'));
			return;
		}
		setLoading(true);
		try {
			const updateData = {
				...editForm,
				roles: editForm.roles || []
			};
			
			const res = await authAPI.updateAccount(editForm.id, updateData);
			if (res?.success) {
				toast.success(t('admin.accounts.updateSuccess', 'Updated successfully!'));
				setShowEdit(false);
				setEditForm(null);
				await fetchAccounts();
			} else {
				toast.error(res?.message || t('admin.accounts.updateError', 'Cannot update'));
			}
			} catch {
				toast.error(t('admin.accounts.updateError', 'Cannot update'));
			} finally {
			setLoading(false);
		}
	}

	async function handleDelete(accountId) {
		if (!window.confirm(t('admin.accounts.confirmDelete', 'Are you sure you want to delete this account?'))) return;
		setLoading(true);
		try {
			const res = await authAPI.deleteAccount(accountId);
			if (res?.success) {
				toast.success(t('admin.accounts.deleteSuccess', 'Account deleted!'));
				await fetchAccounts();
			} else {
				toast.error(res?.message || t('admin.accounts.deleteError', 'Cannot delete'));
			}
			} catch {
				toast.error(t('admin.accounts.deleteError', 'Cannot delete'));
			} finally {
			setLoading(false);
		}
	}

	// Filter, paginate
	const filteredAccounts = (accounts || []).filter(acc => {
		if (!searchQuery || searchQuery.trim() === '') return true;
		const q = searchQuery.toLowerCase().trim();
		const username = (acc.Username || acc.username || '').toString().toLowerCase();
		const fullName = (acc.FullName || acc.fullName || '').toString().toLowerCase();
		const email = (acc.Email || acc.email || '').toString().toLowerCase();
		return username.includes(q) || fullName.includes(q) || email.includes(q);
	});
	const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
	const startIdx = (currentPage - 1) * itemsPerPage;
	const paginatedAccounts = filteredAccounts.slice(startIdx, startIdx + itemsPerPage);
	const roleOptions = roles.map(r => ({ id: r.RoleName, name: r.RoleName }));
	const genderOptions = [
		{ id: 'male', name: t('admin.accounts.genderMale', 'Male') },
		{ id: 'female', name: t('admin.accounts.genderFemale', 'Female') },
		{ id: 'other', name: '⚧ ' + t('admin.accounts.genderOther', 'Other') }
	];

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-4 md:p-8">
			<style>{`
				@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
				@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
				.animate-fadeIn { animation: fadeIn 0.3s ease-in; }
				.animate-slideUp { animation: slideUp 0.3s ease-out; }
				.hover-lift { transition: all 0.3s; }
				.hover-lift:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
			`}</style>
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="mb-8 animate-slideUp">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
							<Users size={24} className="text-white" />
						</div>
						<div>
							<h1 className="text-4xl font-bold text-gray-900">{t('admin.accounts.title', 'Manage Accounts')}</h1>
							<p className="text-gray-500 mt-1">{t('admin.accounts.subtitle', 'Manage system users')}</p>
						</div>
					</div>
				</div>
				{/* Toolbar */}
				<div className="bg-white rounded-2xl shadow-lg p-5 mb-6 hover-lift">
					<div className="flex items-center gap-4 justify-between">
						<div className="max-w-sm w-full text-sm text-gray-600">
							{searchQuery ? `${t('common.searchingFor', 'Searching for')}: "${searchQuery}"` : t('common.allResults', 'All results')}
						</div>
						<div className="flex-1" />
						<button
							onClick={() => { setForm({ username: '', fullName: '', email: '', password: '', role: '', gender: 'male', address: '' }); setShowPassword(false); setShowAdd(true); }}
							className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:shadow-lg active:scale-95 transition font-semibold whitespace-nowrap"
						>
							<Plus size={20} /> {t('admin.accounts.addAccount', 'Add Account')}
						</button>
					</div>
				</div>
				{/* Table */}
				<div className="bg-white rounded-2xl shadow-lg overflow-hidden hover-lift">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
							<tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
								<th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Username</th>
								<th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.accounts.fullName', 'Full Name')}</th>
								<th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Email</th>
								<th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.accounts.gender', 'Gender')}</th>
								<th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.accounts.address', 'Address')}</th>
								<th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.accounts.roles', 'Roles')}</th>
								<th className="px-6 py-4 text-center text-sm font-bold text-gray-700">{t('admin.accounts.actions', 'Actions')}</th>
							</tr>
							</thead>
							<tbody>
							{loading ? (
								<tr>
									<td colSpan={7} className="px-6 py-12 text-center">
										<span className="text-gray-600 font-medium">{t('admin.accounts.loading', 'Loading...')}</span>
									</td>
								</tr>
							) : paginatedAccounts.length === 0 ? (
								<tr>
								<td colSpan={7} className="px-6 py-12 text-center">
									<div className="text-gray-400">
										<Users size={48} className="mx-auto mb-3 opacity-30" />
										<p className="text-lg font-medium">{t('admin.accounts.noAccounts', 'No accounts found')}</p>
									</div>
								</td>
								</tr>
							) : (
									paginatedAccounts.map((account, idx) => (
										<tr key={account.AccountID} className={`border-b transition-all hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
											<td className="px-6 py-4 text-sm font-semibold text-gray-900 align-middle">{account.Username}</td>
											<td className="px-6 py-4 text-sm text-gray-700 align-middle">{account.FullName}</td>
											<td className="px-6 py-4 text-sm text-gray-600 align-middle">
												<div className="flex items-center gap-2">
													<Mail size={16} className="text-blue-500" /> {account.Email}
												</div>
											</td>
										<td className="px-6 py-4 text-sm align-middle">
											{(() => {
												const gender = account.gender || account.Gender;
												if (!gender || gender === 'NULL' || gender === '') return '⚧ ' + t('admin.accounts.genderOther', 'Other');
												if (gender.toLowerCase() === 'male') return t('admin.accounts.genderMale', 'Male');
												if (gender.toLowerCase() === 'female') return t('admin.accounts.genderFemale', 'Female');
												if (gender.toLowerCase() === 'other') return '⚧ ' + t('admin.accounts.genderOther', 'Other');
												return '⚧ ' + t('admin.accounts.genderOther', 'Other');
											})()}
										</td>
											<td className="px-6 py-4 text-sm text-gray-600 align-middle">
												<div className="flex items-center gap-2">
													<MapPin size={16} className="text-red-500 flex-shrink-0" />
													<span className="truncate max-w-xs">{account.address || account.Address || '-'}</span>
												</div>
											</td>
											<td className="px-6 py-4 text-sm align-middle">
												<div className="flex flex-wrap gap-1">
													{(account.roles || account.Roles || []).length > 0 ? (
														(account.roles || account.Roles).map((role, idx) => (
															<span
																key={role.roleId || role.RoleID || idx}
																className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold transition ${
																	(role.roleName || role.RoleName) === 'Admin' ? 'bg-red-100 text-red-700 border border-red-300' :
																	(role.roleName || role.RoleName) === 'Owner' ? 'bg-purple-100 text-purple-700 border border-purple-300' :
																	'bg-green-100 text-green-700 border border-green-300'
																}`}
															>
																{role.roleName || role.RoleName}
															</span>
														))
													) : (
														<span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">{t('admin.accounts.defaultRole', 'User')}</span>
													)}
												</div>
											</td>
											<td className="px-6 py-4 text-sm align-middle">
												<div className="flex items-center justify-center gap-2">
													<button onClick={() => handleEdit(account)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition transform hover:scale-110" title={t('admin.accounts.actions', 'Edit')}><Edit3 size={18} /></button>
													<button onClick={() => handleDelete(account.AccountID)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition transform hover:scale-110" title={t('admin.accounts.actions', 'Delete')}><Trash2 size={18} /></button>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
					{/* Pagination */}
					{totalPages > 1 && (
						<div className="bg-gradient-to-r from-gray-50 to-gray-100 border-t-2 border-gray-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
							<div className="text-sm text-gray-600 font-medium">
								{t('admin.accounts.showing', 'Showing')} <span className="font-bold text-blue-600">{startIdx + 1}</span> {t('admin.accounts.to', 'to')} <span className="font-bold text-blue-600">{Math.min(startIdx + itemsPerPage, filteredAccounts.length)}</span> {t('admin.accounts.of', 'of')} <span className="font-bold text-blue-600">{filteredAccounts.length}</span> {t('admin.accounts.results', 'results')}
							</div>
							<div className="flex gap-2 flex-wrap justify-center">
								<button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold">← {t('admin.accounts.previous', 'Previous')}</button>
								{Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
									<button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-2 rounded-lg transition font-semibold ${currentPage === page ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'border-2 border-gray-300 text-gray-700 hover:bg-gray-100'}`}>{page}</button>
								))}
								<button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold">{t('admin.accounts.next', 'Next')} →</button>
							</div>
						</div>
					)}
				</div>
			</div>
			{/* Add Modal */}
			<Modal open={showAdd} onClose={() => setShowAdd(false)} title={t('admin.accounts.addNewAccount', '➡️ Add New Account')}>
				<InputField label={t('admin.accounts.username', 'Username')} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder={t('admin.accounts.enterUsername', 'Enter username')} autoComplete="off" />
				<InputField label={t('admin.accounts.fullName', 'Full Name')} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder={t('admin.accounts.enterFullName', 'Enter full name')} />
				<InputField label={t('admin.accounts.email', 'Email')} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={t('admin.accounts.enterEmail', 'Enter email')} autoComplete="email" />
				<InputField label={t('admin.accounts.password', 'Password *')} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={t('admin.accounts.enterPassword', 'Enter password')} showPassword={showPassword} onTogglePassword={() => setShowPassword(!showPassword)} />
				<SelectField label={t('admin.accounts.roles', 'Roles')} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} options={roleOptions} />
				<SelectField label={t('admin.accounts.gender', 'Gender')} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} options={genderOptions} />
				<SelectField label={t('admin.accounts.address', 'Address')} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} options={areas.map(a => ({ id: a.AreaName, name: a.AreaName }))} />
				<div className="mt-6 flex gap-3 justify-end border-t pt-4 border-gray-200">
					<button onClick={() => setShowAdd(false)} className="px-5 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition">{t('admin.accounts.cancel', 'Cancel')}</button>
					<button onClick={handleCreate} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 font-medium transition">{loading ? t('admin.accounts.creating', 'Creating...') : t('admin.accounts.createAccount', 'Create Account')}</button>
				</div>
			</Modal>
			{/* Edit Modal */}
			<Modal open={showEdit} onClose={() => setShowEdit(false)} title={t('admin.accounts.editAccount', '✏️ Edit Account')}>
				{editForm && (
					<>
						<InputField label={t('admin.accounts.username', 'Username')} value={editForm.username} disabled placeholder={t('admin.accounts.usernameNoChange', 'Username (cannot be changed)')} />
						<InputField label={t('admin.accounts.fullName', 'Full Name') + ' *'} value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} placeholder={t('admin.accounts.enterFullName', 'Enter full name')} />
						<InputField label={t('admin.accounts.email', 'Email') + ' *'} type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder={t('admin.accounts.enterEmail', 'Enter email')} />
						<SelectField label={t('admin.accounts.gender', 'Gender')} value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })} options={genderOptions} />
						<SelectField label={t('admin.accounts.address', 'Address')} value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} options={areas.map(a => ({ id: a.AreaName, name: a.AreaName }))} />
						<MultiRoleSelector 
							label={t('admin.accounts.roles', 'Roles')} 
							selectedRoles={editForm.roles || []} 
							availableRoles={roles}
							onAddRole={(roleName) => setEditForm({ ...editForm, roles: [...(editForm.roles || []), roleName] })}
							onRemoveRole={(roleName) => setEditForm({ ...editForm, roles: (editForm.roles || []).filter(r => r !== roleName) })}
						/>
						<div className="mt-6 flex gap-3 justify-end border-t pt-4 border-gray-200">
							<button onClick={() => setShowEdit(false)} className="px-6 py-2.5 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold transition">{t('admin.accounts.cancel', 'Cancel')}</button>
							<button onClick={handleUpdate} disabled={loading} className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:shadow-lg disabled:opacity-50 font-semibold transition">{loading ? t('admin.accounts.saving', 'Saving...') : t('admin.accounts.saveChanges', 'Save Changes')}</button>
						</div>
					</>
				)}
			</Modal>
		</div>
	);
}

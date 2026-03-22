pub fn parse_socket_inode(link_target: &str) -> Option<u64> {
    let value = link_target.strip_prefix("socket:[")?.strip_suffix(']')?;
    value.parse::<u64>().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_socket_inode_from_fd_symlink() {
        assert_eq!(parse_socket_inode("socket:[12345]"), Some(12_345));
        assert_eq!(parse_socket_inode("anon_inode:[eventfd]"), None);
    }
}
